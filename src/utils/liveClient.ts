/**
 * Gemini Live API session for the health intake conversation.
 *
 * This is a genuine audio-to-audio dialogue over the Live API WebSocket, not
 * speech-to-text feeding a text model. The browser streams microphone PCM to
 * `gemini-3.1-flash-live-preview`, the model streams speech back, and it calls
 * the clinical tools mid-utterance while the patient is still talking.
 *
 * The browser never sees GEMINI_API_KEY. `/api/live/token` mints a short-lived,
 * single-use ephemeral token with the model, system instruction and tool
 * declarations locked in server-side, and the browser connects with that.
 */

import { GoogleGenAI, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai';
import {
  LIVE_INPUT_SAMPLE_RATE,
  PcmPlayer,
  decodePcm16,
  encodePcm16,
  loadMicWorklet,
} from './audio';

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'closed' | 'error';

export interface LiveIntakeCallbacks {
  /** Connection lifecycle, for the UI status pill. */
  onStatus: (status: LiveStatus) => void;
  /** Patient speech, transcribed by the Live API itself. */
  onUserTranscript: (text: string, isFinal: boolean) => void;
  /** Assistant speech, transcribed as it is spoken. */
  onAssistantTranscript: (text: string, isFinal: boolean) => void;
  /** Mid-conversation clinical tool calls. */
  onToolCalls: (calls: FunctionCall[]) => void;
  /** True while model audio is actually coming out of the speakers. */
  onSpeakingChange: (speaking: boolean) => void;
  /** False when the session is running text-only because the mic was refused. */
  onMicState: (active: boolean) => void;
  /** Live microphone peak, drives the waveform visualizer. */
  onLevel: (level: number) => void;
  /** Surfaced to the user verbatim — failures must never be silent here. */
  onError: (message: string) => void;
}

interface TokenResponse {
  token: string;
  model: string;
  apiVersion: string;
  /** Epoch ms after which this token can no longer open a new session. */
  usableUntil: number;
}

/**
 * Minting a token costs a round-trip to Gemini (~0.6-0.8s) and used to sit on
 * the critical path between the click and the socket opening. It depends on
 * nothing the user does, so it is fetched ahead of time — on mount and again
 * when the pointer reaches the microphone button — and consumed on click.
 *
 * Tokens are single-use, so the cache holds at most one and is cleared the
 * moment it is handed out.
 */
let pending: Promise<TokenResponse> | null = null;
let cached: TokenResponse | null = null;

/** Safety margin so a token cannot expire mid-handshake. */
const TOKEN_GUARD_MS = 20_000;

async function fetchToken(): Promise<TokenResponse> {
  const response = await fetch('/api/live/token', { method: 'POST' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Could not mint a Live API token (HTTP ${response.status}). ` +
        `Check that GEMINI_API_KEY is set on the server. ${body}`.trim()
    );
  }

  const data = (await response.json()) as Partial<TokenResponse> & { usableForMs?: number };
  if (!data.token || !data.model) {
    throw new Error('Token endpoint returned an incomplete response.');
  }

  return {
    token: data.token,
    model: data.model,
    apiVersion: data.apiVersion ?? 'v1alpha',
    usableUntil: Date.now() + (data.usableForMs ?? 120_000),
  };
}

/**
 * Warms the token cache. Safe to call repeatedly and safe to ignore — a
 * failure here just means the click path fetches one itself.
 */
export function prewarmLiveToken(): void {
  if (pending) return;
  if (cached && cached.usableUntil - Date.now() > TOKEN_GUARD_MS) return;

  pending = fetchToken()
    .then((t) => {
      cached = t;
      return t;
    })
    .catch(() => {
      cached = null;
      throw new Error('prewarm failed');
    })
    .finally(() => {
      pending = null;
    });

  // Nothing awaits a prewarm; swallow so it never surfaces as an unhandled
  // rejection. The real error is raised again if the click path needs one.
  pending.catch(() => undefined);
}

export class LiveIntakeSession {
  private callbacks: LiveIntakeCallbacks;
  private session: Session | null = null;
  private player: PcmPlayer;

  private micStream: MediaStream | null = null;
  private micContext: AudioContext | null = null;
  private micNode: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private status: LiveStatus = 'idle';
  private speaking = false;

  // Transcripts stream in fragments; accumulate until the turn closes.
  private userTurn = '';
  private assistantTurn = '';

  constructor(callbacks: LiveIntakeCallbacks) {
    this.callbacks = callbacks;
    this.player = new PcmPlayer(() => this.setSpeaking(false));
  }

  get isLive(): boolean {
    return this.status === 'live';
  }

  private setStatus(status: LiveStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }

  private setSpeaking(speaking: boolean): void {
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    this.callbacks.onSpeakingChange(speaking);
  }

  /**
   * Opens the microphone and the Live API socket. Must be called from a user
   * gesture so the browser lets us start audio.
   */
  async start(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'live') return;
    this.setStatus('connecting');

    try {
      // Microphone and token are independent, so race them instead of
      // chaining: the permission grant and the round-trip to Gemini overlap,
      // which takes ~0.5s off every session start.
      //
      // A mic refusal is not fatal: reviewers without a working mic can still
      // type or run a preset scenario against the same live session.
      // The socket does not need the microphone, so it must not wait for it.
      // Opening the mic costs ~0.5-1.0s; the handshake costs ~1.3s. Run them
      // together and the session is ready roughly a second sooner. Captured
      // frames are dropped until the status flips to 'live', so there is no
      // race between the two.
      void this.startMicrophone().then(
        () => {
          this.callbacks.onMicState(true);
        },
        (micError: unknown) => {
          this.callbacks.onMicState(false);
          const reason = micError instanceof Error ? micError.message : String(micError);
          this.callbacks.onError(
            `Microphone unavailable (${reason}). Continuing in text-only mode — ` +
              'you can still type or run a preset clinical scenario.'
          );
        }
      );

      const [{ token, model, apiVersion }] = await Promise.all([
        this.mintToken(),
        this.player.unlock(),
      ]);

      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion },
      });

      // Model config (system instruction, tools, voice, transcription) is
      // locked into the token server-side, so nothing clinical is passed here.
      this.session = await ai.live.connect({
        model,
        callbacks: {
          // Deliberately not 'live' yet: the socket accepts turns only after
          // setupComplete, and anything sent before it is silently dropped.
          onopen: () => undefined,
          onmessage: (message) => this.handleMessage(message),
          onerror: (event) => {
            this.callbacks.onError(
              `Live API connection error: ${event?.message ?? 'unknown transport failure'}`
            );
            this.setStatus('error');
            void this.stop();
          },
          onclose: () => {
            if (this.status !== 'error') this.setStatus('closed');
            void this.stop();
          },
        },
      });
    } catch (error) {
      await this.teardownAudio();
      const detail = error instanceof Error ? error.message : String(error);
      this.callbacks.onError(detail);
      this.setStatus('error');
    }
  }

  /** Takes the prewarmed token if one is ready, otherwise fetches now. */
  private async mintToken(): Promise<TokenResponse> {
    if (cached && cached.usableUntil - Date.now() > TOKEN_GUARD_MS) {
      const token = cached;
      cached = null; // single-use
      return token;
    }

    if (pending) {
      try {
        const token = await pending;
        cached = null;
        if (token.usableUntil - Date.now() > TOKEN_GUARD_MS) return token;
      } catch {
        // Fall through to a fresh fetch below.
      }
    }

    return fetchToken();
  }

  private async startMicrophone(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Pinning the context to 16 kHz lets the browser resample the mic for us.
    this.micContext = new AudioContext({ sampleRate: LIVE_INPUT_SAMPLE_RATE });
    if (this.micContext.state === 'suspended') {
      await this.micContext.resume();
    }

    await loadMicWorklet(this.micContext);

    this.micSource = this.micContext.createMediaStreamSource(this.micStream);
    this.micNode = new AudioWorkletNode(this.micContext, 'mic-capture');

    this.micNode.port.onmessage = (event: MessageEvent) => {
      const { samples, level } = event.data as { samples: Float32Array; level: number };
      this.callbacks.onLevel(level);

      // The socket only accepts input after setupComplete.
      if (!this.session || this.status !== 'live') return;
      this.session.sendRealtimeInput({
        audio: {
          data: encodePcm16(samples),
          mimeType: `audio/pcm;rate=${LIVE_INPUT_SAMPLE_RATE}`,
        },
      });
    };

    this.micSource.connect(this.micNode);
    // Worklet has no output; keep it pulled by the graph without audible echo.
    this.micNode.connect(this.micContext.destination);
  }

  private handleMessage(message: LiveServerMessage): void {
    if (message.setupComplete) {
      this.setStatus('live');
    }

    const content = message.serverContent;

    // Barge-in: the model stops generating the moment the patient speaks over
    // it, so drop whatever is still queued for playback.
    if (content?.interrupted) {
      this.player.stop();
      this.setSpeaking(false);
      if (this.assistantTurn.trim()) {
        this.callbacks.onAssistantTranscript(this.assistantTurn.trim(), true);
        this.assistantTurn = '';
      }
    }

    const interim = content?.interimInputTranscription?.text;
    if (interim) {
      this.callbacks.onUserTranscript(interim, false);
    }

    const userText = content?.inputTranscription?.text;
    if (userText) {
      this.userTurn += userText;
      this.callbacks.onUserTranscript(this.userTurn, false);
    }

    const assistantText = content?.outputTranscription?.text;
    if (assistantText) {
      this.assistantTurn += assistantText;
      this.callbacks.onAssistantTranscript(this.assistantTurn, false);
    }

    for (const part of content?.modelTurn?.parts ?? []) {
      const audio = part.inlineData?.data;
      if (audio) {
        this.player.enqueue(decodePcm16(audio));
        this.setSpeaking(true);
      }
    }

    if (message.toolCall?.functionCalls?.length) {
      this.handleToolCalls(message.toolCall.functionCalls);
    }

    // A turn can finish generating without `turnComplete` ever arriving, so
    // commit on either signal or the spoken text never leaves the live bubble.
    if (content?.generationComplete || content?.turnComplete) {
      this.flushTurns();
    }
  }

  /** Moves the in-flight transcripts into the committed conversation log. */
  private flushTurns(): void {
    if (this.userTurn.trim()) {
      this.callbacks.onUserTranscript(this.userTurn.trim(), true);
      this.userTurn = '';
    }
    if (this.assistantTurn.trim()) {
      this.callbacks.onAssistantTranscript(this.assistantTurn.trim(), true);
      this.assistantTurn = '';
    }
  }

  /**
   * The clinical tools are recorders, not lookups — they push structured data
   * into the dashboard. Each one still needs a response or the model stalls
   * waiting on it mid-conversation.
   */
  private handleToolCalls(calls: FunctionCall[]): void {
    this.callbacks.onToolCalls(calls);

    this.session?.sendToolResponse({
      functionResponses: calls.map((call) => ({
        id: call.id,
        name: call.name,
        response: { status: 'recorded', recordedAt: new Date().toISOString() },
      })),
    });
  }

  /** Sends a typed message or a preset scenario as a complete patient turn. */
  sendText(text: string): void {
    if (!this.session) return;
    this.player.stop();
    this.setSpeaking(false);
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
  }

  /** Manual barge-in from the stop button. */
  interrupt(): void {
    this.player.stop();
    this.setSpeaking(false);
  }

  async stop(): Promise<void> {
    await this.teardownAudio();

    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Socket already gone.
      }
      this.session = null;
    }

    // Don't lose a half-finished exchange when the patient ends the session.
    this.flushTurns();
    this.setSpeaking(false);

    if (this.status !== 'error') this.setStatus('idle');
  }

  private async teardownAudio(): Promise<void> {
    this.player.stop();

    if (this.micNode) {
      this.micNode.port.onmessage = null;
      this.micNode.disconnect();
      this.micNode = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micContext) {
      await this.micContext.close().catch(() => undefined);
      this.micContext = null;
    }

    this.callbacks.onLevel(0);
    this.callbacks.onMicState(false);
  }
}
