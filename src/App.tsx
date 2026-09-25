/**
 * NSOffice Live Health Intake Assistant
 * Built for Network Science Assignment (Project 5: Live Health Intake Assistant)
 *
 * The patient talks to Gemini over a Live API WebSocket — real audio in, real
 * audio out, with barge-in. While they are still speaking, the model calls the
 * clinical tools, and those calls populate the extraction dashboard and the
 * physician SOAP handoff live.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { DialogueStream } from './components/DialogueStream';
import { ClinicalExtractionPanel } from './components/ClinicalExtractionPanel';
import { DoctorHandoffView } from './components/DoctorHandoffView';
import { LiveIntakeSession, prewarmLiveToken, type LiveStatus } from './utils/liveClient';
import { formatToolCallSummary } from './utils/toolSummary';
import {
  ChatMessage,
  SymptomRecord,
  RedFlagAlert,
  PatientHistory,
  ClinicalAssessment,
  DoctorHandoffNote,
  TriageUrgency,
  ToolCallExecution,
} from './types/clinical';
import { ClinicalScenario } from './data/clinicalScenarios';

const URGENCY_RANK: Record<TriageUrgency, number> = {
  routine: 0,
  urgent: 1,
  emergency: 2,
};

const clockTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [activeView, setActiveView] = useState<'intake' | 'handoff'>('intake');

  // Live session state
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const sessionRef = useRef<LiveIntakeSession | null>(null);

  // Tool calls usually land before the model finishes speaking, so they are
  // held here and pinned onto the assistant bubble that reports them.
  const pendingToolCallsRef = useRef<ToolCallExecution[]>([]);

  // Clinical State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        "Hello, I am your NSOffice Live Health Intake Assistant. Press the microphone to start a live voice consultation, and describe what symptoms brought you in today.",
      timestamp: clockTime(),
    },
  ]);

  const [symptoms, setSymptoms] = useState<SymptomRecord[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagAlert[]>([]);
  const [history, setHistory] = useState<PatientHistory>({
    allergies: [],
    conditions: [],
    medications: [],
    surgicalHistory: [],
  });
  const [assessment, setAssessment] = useState<ClinicalAssessment | null>(null);
  const [handoff, setHandoff] = useState<DoctorHandoffNote | null>(null);
  const [allToolCalls, setAllToolCalls] = useState<ToolCallExecution[]>([]);
  const [triageLevel, setTriageLevel] = useState<TriageUrgency>('routine');

  const isLive = status === 'live';

  // Session timer only runs while the socket is actually open.
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setSessionSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  // Get a token in flight immediately so the click path does not pay for it.
  useEffect(() => {
    prewarmLiveToken();
  }, []);

  // Tear the socket and microphone down if the component goes away.
  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /** Triage never de-escalates on its own — only ratchets upward. */
  const escalateTriage = useCallback((level?: TriageUrgency) => {
    if (!level || !(level in URGENCY_RANK)) return;
    setTriageLevel((prev) => (URGENCY_RANK[level] > URGENCY_RANK[prev] ? level : prev));
  }, []);

  /**
   * Apply mid-conversation tool calls to the dashboard.
   *
   * Every update here is a functional setState: these run from Live API socket
   * callbacks registered once at connect time, so reading component state
   * directly would read whatever it was when the session opened.
   */
  const processIncomingToolCalls = useCallback(
    (toolCalls: ToolCallExecution[]) => {
      toolCalls.forEach((tc) => {
        const { toolName, arguments: args } = tc;

        if (toolName === 'record_symptom' && args.symptomName) {
          const newSym: SymptomRecord = {
            id: `sym_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: args.symptomName,
            location: args.bodyLocation || 'other',
            severity: typeof args.severity === 'number' ? args.severity : 5,
            onset: args.onset || 'recent',
            duration: args.duration || 'ongoing',
            character: args.character,
            radiation: args.radiation,
            aggravatingOrRelieving: args.aggravatingOrRelieving,
            extractedAt: tc.timestamp,
          };

          setSymptoms((prev) => {
            const exists = prev.some(
              (p) =>
                p.name.toLowerCase() === newSym.name.toLowerCase() &&
                p.location === newSym.location
            );
            if (exists) return prev;
            return [newSym, ...prev];
          });
        }

        if (toolName === 'flag_triage_red_flag' && args.finding) {
          const newFlag: RedFlagAlert = {
            id: `rf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            level: args.urgencyLevel || 'urgent',
            finding: args.finding,
            rationale: args.clinicalRationale || 'Alarms clinical criteria',
            immediateRecommendation: args.immediateRecommendation || 'Urgent evaluation',
            timestamp: tc.timestamp,
          };

          setRedFlags((prev) => [newFlag, ...prev]);
          escalateTriage(args.urgencyLevel);
        }

        if (toolName === 'record_patient_history') {
          setHistory((prev) => ({
            allergies: Array.from(new Set([...prev.allergies, ...(args.allergies || [])])),
            conditions: Array.from(new Set([...prev.conditions, ...(args.conditions || [])])),
            medications: Array.from(new Set([...prev.medications, ...(args.medications || [])])),
            surgicalHistory: Array.from(
              new Set([...prev.surgicalHistory, ...(args.surgicalHistory || [])])
            ),
          }));
        }

        if (toolName === 'update_clinical_assessment') {
          setAssessment({
            provisionalImpression: args.provisionalImpression || 'Pending',
            differentials: args.differentials || [],
            affectedOrganSystems: args.affectedOrganSystems || [],
            recommendedPriority: args.recommendedPriority || 'routine',
            suggestedPhysicianExam: args.suggestedPhysicianExam || [],
          });
          escalateTriage(args.recommendedPriority);
        }

        if (toolName === 'generate_doctor_handoff') {
          setHandoff({
            chiefComplaint: args.chiefComplaint || 'Consultation intake',
            hpi: args.hpi || '',
            soapSubjective: args.soapSubjective || '',
            soapObjective: args.soapObjective || '',
            soapAssessment: args.soapAssessment || '',
            soapPlan: args.soapPlan || '',
            urgencyLevel: args.urgencyLevel || 'routine',
            suggestedDiagnosticOrders: args.suggestedDiagnosticOrders || [],
            redFlagsSummary: args.redFlagsSummary || [],
            generatedAt: clockTime(),
            doctorChecklist: args.doctorChecklist || [],
          });
          escalateTriage(args.urgencyLevel);
        }
      });
    },
    [escalateTriage]
  );

  /** Creates the session object and wires the Live API events into React state. */
  const buildSession = useCallback(() => {
    return new LiveIntakeSession({
      onStatus: (next) => {
        setStatus(next);
        setIsProcessing(next === 'connecting');
        if (next === 'idle' || next === 'closed' || next === 'error') {
          setInterimTranscript('');
          setMicLevel(0);
        }
      },

      onUserTranscript: (text, isFinal) => {
        if (!isFinal) {
          setInterimTranscript(text);
          return;
        }
        setInterimTranscript('');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_u`,
            role: 'user',
            content: text,
            timestamp: clockTime(),
          },
        ]);
      },

      onAssistantTranscript: (text, isFinal) => {
        if (!isFinal) {
          setStreamingReply(text);
          return;
        }
        setStreamingReply('');
        const attached = pendingToolCallsRef.current;
        pendingToolCallsRef.current = [];
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: text,
            timestamp: clockTime(),
            toolCalls: attached.length ? attached : undefined,
          },
        ]);
      },

      onToolCalls: (calls) => {
        const executions: ToolCallExecution[] = calls.map((call) => ({
          id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          toolName: call.name || 'unknown_tool',
          arguments: (call.args as Record<string, any>) || {},
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          summary: formatToolCallSummary(call.name || '', (call.args as Record<string, any>) || {}),
        }));

        pendingToolCallsRef.current = [...pendingToolCallsRef.current, ...executions];
        setAllToolCalls((prev) => [...prev, ...executions]);
        processIncomingToolCalls(executions);
      },

      onSpeakingChange: setIsSpeaking,
      onMicState: setMicActive,
      onLevel: setMicLevel,
      onError: (message) => setError(message),
    });
  }, [processIncomingToolCalls]);

  /** Mic button: opens or closes the live voice session. */
  const handleToggleListening = async () => {
    if (isLive || status === 'connecting') {
      await sessionRef.current?.stop();
      sessionRef.current = null;
      return;
    }

    setError(null);
    setSessionSeconds(0);

    const session = buildSession();
    sessionRef.current = session;
    await session.start();
  };

  /** Typed input and preset scenarios enter the same live session as a turn. */
  const handleSendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!sessionRef.current?.isLive) {
      setError('Start the live session first — press the microphone button to connect.');
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: trimmed,
        timestamp: clockTime(),
      },
    ]);

    sessionRef.current.sendText(trimmed);
  };

  // Compile Doctor Handoff on demand
  const handleGenerateHandoff = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch('/api/intake/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: messages, symptoms, redFlags, history }),
      });

      const data = await response.json();

      if (!response.ok || !data.handoff) {
        setError(data.error || 'Could not generate the SOAP handoff note.');
        return;
      }

      setHandoff({ ...data.handoff, generatedAt: clockTime() });
      setActiveView('handoff');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not reach the server to generate the handoff.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectScenario = (scenario: ClinicalScenario) => {
    handleSendMessage(scenario.initialUtterance);
  };

  /** Manual barge-in — cut the assistant off mid-sentence. */
  const handleStopAudio = () => {
    sessionRef.current?.interrupt();
  };

  // The in-flight assistant turn renders as a live bubble until it is final.
  const visibleMessages: ChatMessage[] = streamingReply
    ? [
        ...messages,
        {
          id: 'msg_streaming',
          role: 'assistant',
          content: streamingReply,
          timestamp: clockTime(),
        },
      ]
    : messages;

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink selection:bg-accent/30">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        triageLevel={triageLevel}
        extractedSymptomCount={symptoms.length}
        redFlagCount={redFlags.length}
        sessionDuration={formatTimer(sessionSeconds)}
        hasHandoff={!!handoff}
      />

      {/* Failures are shown, never silently swapped for canned clinical text. */}
      {error && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-start gap-3 rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 backdrop-blur-xl">
            <AlertTriangle className="w-4 h-4 text-critical mt-0.5 shrink-0" />
            <p className="flex-1 text-[13px] leading-relaxed text-ink">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-ink-soft hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-hidden">
        {activeView === 'intake' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-6.5rem)]">
            <div className="lg:col-span-7 h-full flex flex-col min-h-0">
              <DialogueStream
                messages={visibleMessages}
                isListening={isLive}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                isConnecting={status === 'connecting'}
                micActive={micActive}
                onPrewarm={prewarmLiveToken}
                micLevel={micLevel}
                interimTranscript={interimTranscript}
                onToggleListening={handleToggleListening}
                onSendMessage={handleSendMessage}
                onSelectScenario={handleSelectScenario}
                onGenerateHandoff={handleGenerateHandoff}
                onStopAudio={handleStopAudio}
                hasEnoughDataForHandoff={symptoms.length > 0 || messages.length >= 3}
              />
            </div>

            <div className="lg:col-span-5 h-full flex flex-col min-h-0">
              <ClinicalExtractionPanel
                symptoms={symptoms}
                redFlags={redFlags}
                history={history}
                assessment={assessment}
                triageLevel={triageLevel}
                allToolCalls={allToolCalls}
              />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <DoctorHandoffView
              handoff={handoff}
              symptoms={symptoms}
              redFlags={redFlags}
              history={history}
              onReturnToIntake={() => setActiveView('intake')}
              onGenerateHandoffAgain={handleGenerateHandoff}
              isGenerating={isProcessing}
            />
          </div>
        )}
      </main>
    </div>
  );
}
