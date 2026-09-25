/**
 * NSOffice Live Health Intake Assistant
 * Built for Network Science Assignment (Project 5: Live Health Intake Assistant)
 * Features real-time voice dialogue, mid-conversation Gemini tool calling,
 * dynamic anatomical mapping, and physician SOAP handoff synthesis.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { DialogueStream } from './components/DialogueStream';
import { ClinicalExtractionPanel } from './components/ClinicalExtractionPanel';
import { DoctorHandoffView } from './components/DoctorHandoffView';
import { speechClient } from './utils/speech';
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

export default function App() {
  const [activeView, setActiveView] = useState<'intake' | 'handoff'>('intake');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Clinical State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        "Hello, I am your NSOffice Live Health Intake Assistant. Before your consultation with the physician, please describe what symptoms brought you in today and how you're feeling.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  // Track session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle Microphone Speech Recognition
  const handleToggleListening = () => {
    if (isListening) {
      speechClient.stopListening();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      // Barge-in: stop any assistant audio
      speechClient.cancelSpeech();
      setIsSpeaking(false);

      if (!speechClient.isSupported()) {
        alert(
          'Web Speech API is not supported in this browser. You can type in the dialogue bar or select a clinical case study!'
        );
        return;
      }

      setIsListening(true);
      speechClient.startListening(
        (transcript, isFinal) => {
          if (isFinal) {
            setInterimTranscript('');
            handleSendMessage(transcript);
          } else {
            setInterimTranscript(transcript);
          }
        },
        (error) => {
          console.warn('Speech error:', error);
          setIsListening(false);
          setInterimTranscript('');
        },
        () => {
          setIsListening(false);
        }
      );
    }
  };

  // Send patient message to server-side Gemini Tool Calling pipeline
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Interrupt previous speech
    speechClient.cancelSpeech();
    setIsSpeaking(false);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/intake/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          currentSymptoms: symptoms,
        }),
      });

      const data = await response.json();

      // Process any tool calls returned by Gemini
      const newToolCalls: ToolCallExecution[] = data.toolCalls || [];
      if (newToolCalls.length > 0) {
        setAllToolCalls((prev) => [...prev, ...newToolCalls]);
        processIncomingToolCalls(newToolCalls);
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: data.reply || 'Thank you for sharing. Could you tell me more about the intensity?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: newToolCalls,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Speak verbal response aloud with Web Speech synthesis
      setIsSpeaking(true);
      speechClient.speak(assistantMsg.content, () => {
        setIsSpeaking(false);
      });
    } catch (err) {
      console.error('Failed to communicate with intake engine:', err);
      const fallbackMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content:
          "I recorded those details. Could you let me know on a scale of 1 to 10 how severe the discomfort feels?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process and apply mid-conversation tool calls to the application state
  const processIncomingToolCalls = (toolCalls: ToolCallExecution[]) => {
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
          // Avoid duplicate same symptoms
          const exists = prev.some(
            (p) => p.name.toLowerCase() === newSym.name.toLowerCase() && p.location === newSym.location
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

        // Elevate triage status
        if (args.urgencyLevel === 'emergency') {
          setTriageLevel('emergency');
        } else if (args.urgencyLevel === 'urgent' && triageLevel !== 'emergency') {
          setTriageLevel('urgent');
        }
      }

      if (toolName === 'record_patient_history') {
        setHistory((prev) => ({
          allergies: Array.from(new Set([...prev.allergies, ...(args.allergies || [])])),
          conditions: Array.from(new Set([...prev.conditions, ...(args.conditions || [])])),
          medications: Array.from(new Set([...prev.medications, ...(args.medications || [])])),
          surgicalHistory: Array.from(new Set([...prev.surgicalHistory, ...(args.surgicalHistory || [])])),
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

        if (args.recommendedPriority === 'emergency') {
          setTriageLevel('emergency');
        } else if (args.recommendedPriority === 'urgent' && triageLevel !== 'emergency') {
          setTriageLevel('urgent');
        }
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
          generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          doctorChecklist: args.doctorChecklist || [],
        });
      }
    });
  };

  // Compile Doctor Handoff on demand
  const handleGenerateHandoff = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/intake/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: messages,
          symptoms,
          redFlags,
          history,
        }),
      });

      const data = await response.json();
      if (data.handoff) {
        setHandoff({
          ...data.handoff,
          generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setActiveView('handoff');
      }
    } catch (e) {
      console.error('Error generating handoff:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Select a preset clinical scenario
  const handleSelectScenario = (scenario: ClinicalScenario) => {
    handleSendMessage(scenario.initialUtterance);
  };

  // Replay speech audio
  const handleReplayAudio = (text: string) => {
    setIsSpeaking(true);
    speechClient.speak(text, () => {
      setIsSpeaking(false);
    });
  };

  const handleStopAudio = () => {
    speechClient.cancelSpeech();
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-[#E8ECF2] selection:bg-[#0062FF]/30">
      {/* NSOffice Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        triageLevel={triageLevel}
        extractedSymptomCount={symptoms.length}
        redFlagCount={redFlags.length}
        sessionDuration={formatTimer(sessionSeconds)}
        hasHandoff={!!handoff}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-hidden">
        {activeView === 'intake' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-6.5rem)]">
            {/* Left 7 Columns: Voice Dialogue Stream */}
            <div className="lg:col-span-7 h-full flex flex-col min-h-0">
              <DialogueStream
                messages={messages}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                interimTranscript={interimTranscript}
                onToggleListening={handleToggleListening}
                onSendMessage={handleSendMessage}
                onSelectScenario={handleSelectScenario}
                onGenerateHandoff={handleGenerateHandoff}
                onReplayAudio={handleReplayAudio}
                onStopAudio={handleStopAudio}
                hasEnoughDataForHandoff={symptoms.length > 0 || messages.length >= 3}
              />
            </div>

            {/* Right 5 Columns: Live Extractor & Anatomical Map */}
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
