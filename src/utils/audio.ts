/**
 * Raw PCM plumbing for the Gemini Live API audio pipeline.
 *
 * The Live API speaks 16-bit signed little-endian PCM in both directions:
 *   microphone -> model   16 kHz mono  ("audio/pcm;rate=16000")
 *   model -> speaker      24 kHz mono
 *
 * Both rates are fixed by the API, so capture and playback each run in their
 * own AudioContext pinned to the rate they need and let the browser resample.
 */

export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

/**
 * Samples per frame posted from the worklet: 512 = 32 ms at 16 kHz.
 *
 * This is pure added latency — the model cannot hear the tail of an utterance
 * until the frame holding it is flushed. 2048 (128 ms) was costing ~96 ms on
 * every turn. 512 is still 4x the 128-sample render quantum, so the
 * postMessage rate stays modest.
 */
const FRAME_SIZE = 512;

/**
 * AudioWorklet that batches the render quantum (128 frames) into larger chunks
 * before crossing to the main thread, and reports a peak level for the
 * waveform visualizer so it reflects the real microphone rather than an
 * animation.
 */
const MIC_WORKLET_SOURCE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${FRAME_SIZE});
    this._offset = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this._buffer[this._offset++] = channel[i];

      if (this._offset === this._buffer.length) {
        let peak = 0;
        for (let j = 0; j < this._buffer.length; j++) {
          const abs = this._buffer[j] < 0 ? -this._buffer[j] : this._buffer[j];
          if (abs > peak) peak = abs;
        }
        this.port.postMessage({ samples: this._buffer.slice(0), level: peak });
        this._offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCaptureProcessor);
`;

let workletUrl: string | null = null;

/** Registers the capture worklet on a context, compiling it once per page. */
export async function loadMicWorklet(ctx: AudioContext): Promise<void> {
  if (!workletUrl) {
    workletUrl = URL.createObjectURL(
      new Blob([MIC_WORKLET_SOURCE], { type: 'application/javascript' })
    );
  }
  await ctx.audioWorklet.addModule(workletUrl);
}

/** Float32 [-1, 1] -> little-endian PCM16, base64 encoded for the wire. */
export function encodePcm16(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  // Chunked so a long frame cannot blow the argument limit on fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * base64 PCM16 from the model -> Float32 [-1, 1] ready for an AudioBuffer.
 *
 * Explicitly backed by ArrayBuffer (not ArrayBufferLike) so it satisfies
 * `AudioBuffer.copyToChannel`, which rejects SharedArrayBuffer-backed views.
 */
export function decodePcm16(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    samples[i] = pcm[i] / 0x8000;
  }
  return samples;
}

/**
 * Gap-free playback queue for streamed model audio.
 *
 * Chunks arrive faster than real time, so each one is scheduled against a
 * running cursor instead of "now" — otherwise they would overlap. `stop()`
 * is the barge-in path: it drops everything still queued so the assistant
 * goes quiet the moment the patient talks over it.
 */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private cursor = 0;
  private active = new Set<AudioBufferSourceNode>();
  private onIdle: (() => void) | null = null;

  constructor(onIdle?: () => void) {
    this.onIdle = onIdle ?? null;
  }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: LIVE_OUTPUT_SAMPLE_RATE });
    }
    return this.ctx;
  }

  /** Resumes the context; must run inside a user gesture on most browsers. */
  async unlock(): Promise<void> {
    const ctx = this.context();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  enqueue(samples: Float32Array<ArrayBuffer>): void {
    if (samples.length === 0) return;

    const ctx = this.context();
    const buffer = ctx.createBuffer(1, samples.length, LIVE_OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Never schedule in the past: if the queue drained, restart from now.
    this.cursor = Math.max(this.cursor, ctx.currentTime);
    source.start(this.cursor);
    this.cursor += buffer.duration;

    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size === 0) this.onIdle?.();
    };
  }

  /** Barge-in: kill queued audio immediately. */
  stop(): void {
    for (const source of this.active) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished — nothing to cancel.
      }
    }
    this.active.clear();
    this.cursor = 0;
    this.onIdle?.();
  }

  get isPlaying(): boolean {
    return this.active.size > 0;
  }

  async close(): Promise<void> {
    this.stop();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
