import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { DoctorHandoffNote, SymptomRecord, RedFlagAlert, PatientHistory } from '../types/clinical';

interface DoctorHandoffViewProps {
  handoff: DoctorHandoffNote | null;
  symptoms: SymptomRecord[];
  redFlags: RedFlagAlert[];
  history: PatientHistory;
  onReturnToIntake: () => void;
  onGenerateHandoffAgain: () => void;
  isGenerating: boolean;
}

export const DoctorHandoffView: React.FC<DoctorHandoffViewProps> = ({
  handoff,
  symptoms,
  redFlags,
  history,
  onReturnToIntake,
  onGenerateHandoffAgain,
  isGenerating,
}) => {
  const [copied, setCopied] = useState(false);
  const [doctorSignedOff, setDoctorSignedOff] = useState(false);

  const handleCopyMarkdown = () => {
    if (!handoff) return;

    const markdown = `# NSOFFICE.AI CLINICAL INTAKE HANDOFF
Generated: ${handoff.generatedAt || new Date().toLocaleString()}
Triage Status: ${handoff.urgencyLevel.toUpperCase()}

## CHIEF COMPLAINT
${handoff.chiefComplaint}

## HISTORY OF PRESENT ILLNESS (HPI)
${handoff.hpi}

## SOAP NOTE
### S - Subjective
${handoff.soapSubjective}

### O - Objective (Reported & Intake Observations)
${handoff.soapObjective}

### A - Assessment
${handoff.soapAssessment}

### P - Plan & Diagnostic Workup
${handoff.soapPlan}

## SUGGESTED DIAGNOSTIC ORDERS
${handoff.suggestedDiagnosticOrders.map((o) => `- [ ] ${o}`).join('\n')}

## RED FLAGS & IMMEDIATE PRECAUTIONS
${handoff.redFlagsSummary.length > 0 ? handoff.redFlagsSummary.map((rf) => `! ${rf}`).join('\n') : 'No acute red flags identified.'}

## PATIENT ALLERGIES & MEDICATIONS
- Allergies: ${history.allergies.length > 0 ? history.allergies.join(', ') : 'NKDA'}
- Current Meds: ${history.medications.length > 0 ? history.medications.join(', ') : 'None reported'}
- Past Conditions: ${history.conditions.length > 0 ? history.conditions.join(', ') : 'None'}
`;

    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!handoff) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="glass-panel p-8 rounded-2xl max-w-lg mx-auto border border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-[#0062FF]/10 text-[#0062FF] flex items-center justify-center mx-auto mb-4 border border-[#0062FF]/30">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No Doctor Handoff Generated Yet</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            The patient voice intake is still underway or pending synthesis. Click below to trigger the Gemini clinical tool calling engine and compile the structured SOAP handoff.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onGenerateHandoffAgain}
              disabled={isGenerating}
              className="w-full py-3 rounded-xl bg-[#0062FF] hover:bg-[#0052E0] text-white text-xs font-semibold shadow-lg shadow-[#0062FF]/30 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing SOAP Note...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Compile Doctor Handoff Now</span>
                </>
              )}
            </button>
            <button
              onClick={onReturnToIntake}
              className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-medium border border-white/[0.08] transition-all"
            >
              Return to Voice Intake
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isEmergency = handoff.urgencyLevel === 'emergency';
  const isUrgent = handoff.urgencyLevel === 'urgent';

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onReturnToIntake}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Conversation</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-200 border border-white/[0.08] transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy SOAP (Markdown/EHR)</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-200 border border-white/[0.08] transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print / Export PDF</span>
          </button>

          {/* Primary Action */}
          <button
            onClick={() => setDoctorSignedOff(!doctorSignedOff)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              doctorSignedOff
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-[#0062FF] hover:bg-[#0052E0] text-white shadow-[#0062FF]/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{doctorSignedOff ? 'Intake Accepted & Signed Off' : 'Accept & Start Consultation'}</span>
          </button>
        </div>
      </div>

      {/* Main Glass Document Container */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0062FF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Clinical Metadata */}
        <div className="border-b border-white/[0.08] pb-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-[#0062FF] tracking-wider uppercase">
                  NSOFFICE Clinical Intelligence Handoff
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 font-mono">
                  {handoff.generatedAt || new Date().toLocaleString()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Physician Consultation Brief
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Structured clinical synthesis automatically derived from real-time patient voice dialogue via Gemini tool calling.
              </p>
            </div>

            {/* Triage Urgency Badge */}
            <div
              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                isEmergency
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/20'
                  : isUrgent
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/20'
                  : 'bg-[#0062FF]/20 text-blue-300 border-[#0062FF]/40'
              }`}
            >
              {isEmergency && <ShieldAlert className="w-4 h-4 animate-bounce text-rose-400" />}
              <span>TRIAGE: {handoff.urgencyLevel.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Chief Complaint Banner */}
        <div className="p-4 rounded-2xl bg-[#0062FF]/10 border border-[#0062FF]/30 mb-6">
          <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
            Chief Complaint
          </div>
          <div className="text-base font-semibold text-white">
            "{handoff.chiefComplaint}"
          </div>
        </div>

        {/* Red Flags Alert Box */}
        {handoff.redFlagsSummary && handoff.redFlagsSummary.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 mb-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Critical Red Flag Alerts Identified</span>
            </div>
            <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1">
              {handoff.redFlagsSummary.map((rf, idx) => (
                <li key={idx} className="leading-relaxed">
                  {rf}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* HPI - History of Present Illness Narrative */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#0062FF]" />
            <span>History of Present Illness (HPI)</span>
          </h3>
          <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06] text-xs text-slate-200 leading-relaxed font-sans">
            {handoff.hpi}
          </div>
        </div>

        {/* Standardized SOAP Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* S - Subjective */}
          <div className="p-4 rounded-2xl bg-[#111724] border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#0062FF]/20 text-[#0062FF] font-mono font-bold text-xs flex items-center justify-center">
                S
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Subjective
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {handoff.soapSubjective}
            </p>
          </div>

          {/* O - Objective */}
          <div className="p-4 rounded-2xl bg-[#111724] border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
                O
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Objective (Reported & Observed)
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {handoff.soapObjective}
            </p>
          </div>

          {/* A - Assessment */}
          <div className="p-4 rounded-2xl bg-[#111724] border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                A
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Assessment
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {handoff.soapAssessment}
            </p>
          </div>

          {/* P - Plan */}
          <div className="p-4 rounded-2xl bg-[#111724] border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-bold text-xs flex items-center justify-center">
                P
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Plan & Immediate Workup
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {handoff.soapPlan}
            </p>
          </div>
        </div>

        {/* Suggested Diagnostic Orders & Doctor Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
          {/* Diagnostic Orders */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-[#0062FF]" />
              <span>Recommended Diagnostic Orders</span>
            </h4>
            <div className="space-y-1.5">
              {handoff.suggestedDiagnosticOrders?.map((order, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-xs text-slate-300 cursor-pointer border border-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded text-[#0062FF] focus:ring-0 bg-slate-800 border-white/20"
                  />
                  <span>{order}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Patient Safety & Medical Profile */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>Allergy & Profile Safety Checks</span>
            </h4>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Allergies:</span>
                <span className="font-semibold text-rose-300">
                  {history.allergies.length > 0 ? history.allergies.join(', ') : 'No Known Drug Allergies'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Medications:</span>
                <span className="font-semibold text-blue-300">
                  {history.medications.length > 0 ? history.medications.join(', ') : 'None Reported'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Past Medical Conditions:</span>
                <span className="font-semibold text-slate-300">
                  {history.conditions.length > 0 ? history.conditions.join(', ') : 'None Reported'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Doctor Sign-off Status Footer */}
        <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Verified by NSOffice AI Studio</span>
            <span>·</span>
            <span>Gemini 3.8 Flash Tool Calling</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            {doctorSignedOff ? (
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Signed by Attending Physician
              </span>
            ) : (
              <span className="text-amber-400">Pending Physician Review</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
