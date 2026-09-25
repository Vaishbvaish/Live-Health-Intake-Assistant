import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Stethoscope,
  Info,
} from 'lucide-react';
import { ChatMessage, ToolCallExecution } from '../types/clinical';
import { VoiceVisualizer } from './VoiceVisualizer';
import { CLINICAL_SCENARIOS, ClinicalScenario } from '../data/clinicalScenarios';

interface DialogueStreamProps {
  messages: ChatMessage[];
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  interimTranscript: string;
  onToggleListening: () => void;
  onSendMessage: (text: string) => void;
  onSelectScenario: (scenario: ClinicalScenario) => void;
  onGenerateHandoff: () => void;
  onReplayAudio: (text: string) => void;
  onStopAudio: () => void;
  hasEnoughDataForHandoff: boolean;
}

export const DialogueStream: React.FC<DialogueStreamProps> = ({
  messages,
  isListening,
  isSpeaking,
  isProcessing,
  interimTranscript,
  onToggleListening,
  onSendMessage,
  onSelectScenario,
  onGenerateHandoff,
  onReplayAudio,
  onStopAudio,
  hasEnoughDataForHandoff,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<ClinicalScenario | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, interimTranscript, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleScenarioPick = (scenario: ClinicalScenario) => {
    setActiveScenario(scenario);
    onSelectScenario(scenario);
  };

  const handleSendPresetReply = (reply: string) => {
    onSendMessage(reply);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl glass-panel border border-white/[0.08] overflow-hidden">
      {/* Top Banner: Voice visualizer & Quick Clinical Scenarios */}
      <div className="p-4 border-b border-white/[0.06] bg-[#0A0E17]/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0062FF] animate-ping" />
            <span className="text-xs font-semibold text-slate-200">Real-Time Voice Intake</span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-[11px] text-slate-400">Gemini 3.8 Live Tool Calling</span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            {isListening ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Microphone Active
              </span>
            ) : isSpeaking ? (
              <span className="text-[#0062FF] font-medium flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                Assistant Speaking
              </span>
            ) : isProcessing ? (
              <span className="text-indigo-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Extracting Clinical Tools...
              </span>
            ) : (
              <span>Standby / Ready</span>
            )}
          </div>
        </div>

        {/* Audio Waveform */}
        <VoiceVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
        />

        {/* Quick Scenario Chips for Rehearsal & Evaluation */}
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span className="font-medium">Preloaded Clinical Case Studies:</span>
            <span className="text-[10px] text-slate-500">Click to simulate patient utterance</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {CLINICAL_SCENARIOS.map((sc) => {
              const isSelected = activeScenario?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleScenarioPick(sc)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[#0062FF]/20 text-white border border-[#0062FF]'
                      : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] border border-white/[0.06]'
                  }`}
                >
                  <span className="truncate max-w-[170px] inline-block">{sc.title}</span>
                </button>
              );
            })}
          </div>

          {/* If a scenario is active, show quick follow-up answers for testing */}
          {activeScenario && (
            <div className="mt-2.5 p-2 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs">
              <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Patient Scenario Follow-Up Responses:</span>
                <button
                  onClick={() => setActiveScenario(null)}
                  className="text-slate-400 hover:text-white text-[10px]"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeScenario.followUpResponses.map((resText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendPresetReply(resText)}
                    className="text-left text-[11px] bg-white/[0.04] hover:bg-[#0062FF]/20 text-slate-300 hover:text-white px-2.5 py-1 rounded-md border border-white/5 transition-all truncate max-w-full"
                  >
                    "{resText}"
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-[#0062FF]">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Live Clinical Intake Companion
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              Describe your symptoms aloud in plain speech. The assistant will listen in real time, ask targeted clinical follow-ups, and extract structured diagnostic data via mid-conversation tool calls.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Press the Electric Blue mic below</span>
              <span>·</span>
              <span>Or choose a test case above</span>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  {isUser ? 'Patient (Spoken/Input)' : 'NSOffice Intake Assistant'}
                </span>
                <span className="text-[10px] text-slate-600 font-mono">{msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`group relative p-3.5 rounded-2xl max-w-[85%] sm:max-w-[78%] text-sm leading-relaxed transition-all ${
                  isUser
                    ? 'bg-[#0062FF] text-white rounded-tr-sm shadow-lg shadow-[#0062FF]/20 font-medium'
                    : 'bg-[#121824]/90 text-slate-100 rounded-tl-sm border border-white/[0.08] shadow-md'
                }`}
              >
                <div>{msg.content}</div>

                {/* Assistant Speech Playback Button */}
                {!isUser && (
                  <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-between">
                    <button
                      onClick={() => onReplayAudio(msg.content)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
                      title="Replay Voice Utterance"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#0062FF]" />
                      <span>Listen</span>
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">Audio-enabled</span>
                  </div>
                )}
              </div>

              {/* Mid-Conversation Tool Calls Badge Display */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 w-full max-w-[85%] sm:max-w-[78%] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
                    <Sparkles className="w-3 h-3 text-[#0062FF]" />
                    <span>Gemini Mid-Conversation Tool Invocation ({msg.toolCalls.length})</span>
                  </div>

                  {msg.toolCalls.map((tc: ToolCallExecution) => {
                    const isExpanded = expandedToolId === tc.id;
                    const isRedFlag = tc.toolName === 'flag_triage_red_flag';
                    const isHandoff = tc.toolName === 'generate_doctor_handoff';

                    return (
                      <div
                        key={tc.id}
                        className={`rounded-xl border transition-all text-xs overflow-hidden ${
                          isRedFlag
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            : isHandoff
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-white/[0.03] border-white/[0.08] text-slate-300'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedToolId(isExpanded ? null : tc.id)}
                          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {isRedFlag ? (
                              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                            ) : isHandoff ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Code2 className="w-4 h-4 text-[#0062FF] flex-shrink-0" />
                            )}
                            <div className="truncate">
                              <span className="font-mono font-semibold text-[11px] text-white">
                                {tc.toolName}()
                              </span>
                              <span className="mx-1.5 text-slate-500">·</span>
                              <span className="text-[11px] text-slate-400 truncate">
                                {tc.summary}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
                            <span className="text-[10px] font-mono text-slate-500">{tc.timestamp}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Tool Call JSON inspection */}
                        {isExpanded && (
                          <div className="p-3 bg-black/40 border-t border-white/[0.06] font-mono text-[11px] overflow-x-auto text-slate-300">
                            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-sans font-medium">
                              Exact Function Parameters:
                            </div>
                            <pre className="text-slate-300">
                              {JSON.stringify(tc.arguments, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Interim / Live recognition preview */}
        {isListening && interimTranscript && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-emerald-400 font-medium mb-1 animate-pulse">
              Listening live...
            </span>
            <div className="p-3 rounded-2xl max-w-[80%] bg-[#0062FF]/20 border border-[#0062FF]/40 text-slate-200 text-sm italic">
              {interimTranscript} ...
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400">
            <div className="w-4 h-4 border-2 border-[#0062FF] border-t-transparent rounded-full animate-spin" />
            <span>Gemini analyzing clinical dialogue & executing tools...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Primary Action & Controls Bar */}
      <div className="p-4 border-t border-white/[0.08] bg-[#0A0E17]/80">
        {/* If enough data collected, prominent one primary action button */}
        {hasEnoughDataForHandoff && (
          <div className="mb-3">
            <button
              onClick={onGenerateHandoff}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0070F3] hover:from-[#0047E0] hover:to-[#0062FF] text-white text-xs font-semibold shadow-lg shadow-[#0062FF]/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Generate Structured Doctor Handoff Note</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Main Voice Intake Push-to-Talk Toggle (Electric Blue Primary Voice Trigger) */}
          <button
            type="button"
            onClick={onToggleListening}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              isListening
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 animate-pulse'
                : 'bg-[#0062FF] hover:bg-[#0052E0] text-white shadow-lg shadow-[#0062FF]/30 hover:scale-[1.02]'
            }`}
            title={isListening ? 'Stop listening' : 'Start speaking with assistant'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text input for manual or corrected speech */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : 'Type or describe your symptoms...'}
              disabled={isProcessing}
              className="w-full bg-[#121824] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#0062FF] focus:ring-1 focus:ring-[#0062FF] transition-all"
            />
          </div>

          {/* Send text button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:hover:bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
          <span>Speak naturally or type your responses</span>
          <span>Apple-style NSOffice Glass Interface</span>
        </div>
      </div>
    </div>
  );
};
