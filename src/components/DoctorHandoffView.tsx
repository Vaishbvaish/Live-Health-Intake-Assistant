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
          <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 border border-accent/30">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No Doctor Handoff Generated Yet</h2>
          <p className="text-xs text-ink-soft mb-6 leading-relaxed">
            The patient voice intake is still underway or pending synthesis. Click below to trigger the Gemini clinical tool calling engine and compile the structured SOAP handoff.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onGenerateHandoffAgain}
              disabled={isGenerating}
              className="ns-btn-primary w-full py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
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
              className="ns-btn-ghost w-full py-2.5 rounded-xl text-xs font-medium transition-all"
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
          className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Conversation</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyMarkdown}
            className="ns-btn-ghost flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent" />
                <span className="text-accent">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-ink-soft" />
                <span>Copy SOAP (Markdown/EHR)</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="ns-btn-ghost flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-ink-soft" />
            <span>Print / Export PDF</span>
          </button>

          {/* Primary Action */}
          <button
            onClick={() => setDoctorSignedOff(!doctorSignedOff)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              doctorSignedOff ? 'ns-btn-secondary' : 'ns-btn-primary'
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
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Clinical Metadata */}
        <div className="border-b border-white/[0.08] pb-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-accent tracking-wider uppercase">
                  NSOFFICE Clinical Intelligence Handoff
                </span>
                <span className="text-ink-faint">·</span>
                <span className="text-xs text-ink-soft font-mono">
                  {handoff.generatedAt || new Date().toLocaleString()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Physician Consultation Brief
              </h1>
              <p className="text-xs text-ink-soft mt-1">
                Structured clinical synthesis automatically derived from real-time patient voice dialogue via Gemini tool calling.
              </p>
            </div>

            {/* Triage Urgency Badge */}
            <div
              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                isEmergency
                  ? 'bg-critical/20 text-critical border-critical/40 shadow-lg shadow-critical/20'
                  : isUrgent
                  ? 'ns-btn-secondary'
                  : 'bg-accent/20 text-accent-tint border-accent/40'
              }`}
            >
              {isEmergency && <ShieldAlert className="w-4 h-4 animate-bounce text-critical" />}
              <span>TRIAGE: {handoff.urgencyLevel.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Chief Complaint Banner */}
        <div className="p-4 rounded-2xl bg-accent/10 border border-accent/30 mb-6">
          <div className="text-[11px] font-bold text-accent-tint uppercase tracking-wider mb-1">
            Chief Complaint
          </div>
          <div className="text-base font-semibold text-white">
            "{handoff.chiefComplaint}"
          </div>
        </div>

        {/* Red Flags Alert Box */}
        {handoff.redFlagsSummary && handoff.redFlagsSummary.length > 0 && (
          <div className="p-4 rounded-2xl bg-critical/10 border border-critical/30 mb-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-critical uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-critical" />
              <span>Critical Red Flag Alerts Identified</span>
            </div>
            <ul className="list-disc list-inside text-xs text-critical/90 space-y-1">
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent" />
            <span>History of Present Illness (HPI)</span>
          </h3>
          <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06] text-xs text-ink leading-relaxed font-sans">
            {handoff.hpi}
          </div>
        </div>

        {/* Standardized SOAP Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* S - Subjective */}
          <div className="p-4 rounded-2xl bg-surface border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-mono font-bold text-xs flex items-center justify-center">
                S
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Subjective
              </h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              {handoff.soapSubjective}
            </p>
          </div>

          {/* O - Objective */}
          <div className="p-4 rounded-2xl bg-surface border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-mono font-bold text-xs flex items-center justify-center">
                O
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Objective (Reported & Observed)
              </h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              {handoff.soapObjective}
            </p>
          </div>

          {/* A - Assessment */}
          <div className="p-4 rounded-2xl bg-surface border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-mono font-bold text-xs flex items-center justify-center">
                A
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Assessment
              </h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              {handoff.soapAssessment}
            </p>
          </div>

          {/* P - Plan */}
          <div className="p-4 rounded-2xl bg-surface border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-mono font-bold text-xs flex items-center justify-center">
                P
              </span>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Plan & Immediate Workup
              </h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              {handoff.soapPlan}
            </p>
          </div>
        </div>

        {/* Suggested Diagnostic Orders & Doctor Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
          {/* Diagnostic Orders */}
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-accent" />
              <span>Recommended Diagnostic Orders</span>
            </h4>
            <div className="space-y-1.5">
              {handoff.suggestedDiagnosticOrders?.map((order, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-xs text-ink-muted cursor-pointer border border-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded text-accent focus:ring-0 bg-surface-raised border-white/20"
                  />
                  <span>{order}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Patient Safety & Medical Profile */}
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <span>Allergy & Profile Safety Checks</span>
            </h4>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-soft">Allergies:</span>
                <span className="font-semibold text-critical">
                  {history.allergies.length > 0 ? history.allergies.join(', ') : 'No Known Drug Allergies'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Current Medications:</span>
                <span className="font-semibold text-accent-tint">
                  {history.medications.length > 0 ? history.medications.join(', ') : 'None Reported'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Past Medical Conditions:</span>
                <span className="font-semibold text-ink-muted">
                  {history.conditions.length > 0 ? history.conditions.join(', ') : 'None Reported'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Doctor Sign-off Status Footer */}
        <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-ink-dim">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Verified by NSOffice AI Studio</span>
            <span>·</span>
            <span>Gemini Live API Tool Calling</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            {doctorSignedOff ? (
              <span className="text-accent flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                Signed by Attending Physician
              </span>
            ) : (
              <span className="text-ink-soft">Pending Physician Review</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
