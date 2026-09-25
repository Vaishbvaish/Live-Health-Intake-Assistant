import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Base line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      const active = isListening || isSpeaking || isProcessing;
      const barCount = 32;
      const spacing = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const x = i * spacing + spacing / 2;
        let barHeight = 4;

        if (isListening) {
          // Responsive microphone waveform simulation
          const freq = (i / barCount) * Math.PI * 4;
          const amp = Math.sin(freq + phase) * Math.cos(phase * 1.5);
          barHeight = Math.max(6, Math.abs(amp) * 38 + Math.random() * 12);
        } else if (isSpeaking) {
          // Assistant vocal output wave
          const freq = (i / barCount) * Math.PI * 2.5;
          const amp = Math.sin(freq + phase * 2.0);
          barHeight = Math.max(8, Math.abs(amp) * 32 + 8);
        } else if (isProcessing) {
          // Thinking / Tool Calling pulse
          const distance = Math.abs(i - barCount / 2);
          const wave = Math.sin(phase * 3 - distance * 0.4);
          barHeight = Math.max(4, wave * 18 + 10);
        } else {
          // Idle breathing
          barHeight = 4 + Math.sin(phase + i * 0.2) * 2;
        }

        // Color styling: Electric blue
        ctx.beginPath();
        if (isSpeaking) {
          ctx.strokeStyle = '#0062FF';
          ctx.shadowColor = '#0062FF';
          ctx.shadowBlur = 10;
        } else if (isListening) {
          ctx.strokeStyle = '#38BDF8';
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 12;
        } else if (isProcessing) {
          ctx.strokeStyle = '#818CF8';
          ctx.shadowColor = '#818CF8';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 0;
        }

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.moveTo(x, centerY - barHeight / 2);
        ctx.lineTo(x, centerY + barHeight / 2);
        ctx.stroke();
      }

      phase += 0.08;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={360}
        height={64}
        className="w-full max-w-[420px] h-14"
      />
    </div>
  );
};
