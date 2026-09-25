import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  HeartPulse,
  Pill,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  SymptomRecord,
  RedFlagAlert,
  PatientHistory,
  ClinicalAssessment,
  TriageUrgency,
  BodyLocation,
  ToolCallExecution,
} from '../types/clinical';
import { AnatomicalMap } from './AnatomicalMap';

interface ClinicalExtractionPanelProps {
  symptoms: SymptomRecord[];
  redFlags: RedFlagAlert[];
  history: PatientHistory;
  assessment: ClinicalAssessment | null;
  triageLevel: TriageUrgency;
  allToolCalls: ToolCallExecution[];
}

export const ClinicalExtractionPanel: React.FC<ClinicalExtractionPanelProps> = ({
  symptoms,
  redFlags,
  history,
  assessment,
  triageLevel,
  allToolCalls,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<BodyLocation | null>(null);

  const activeLocations: BodyLocation[] = Array.from(
    new Set(symptoms.map((s) => s.location).filter(Boolean))
  );

  const getTriageBadge = () => {
    switch (triageLevel) {
      case 'emergency':
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-500',
          label: 'EMERGENCY / STAT',
          desc: 'Immediate physician evaluation and resuscitation readiness.',
        };
      case 'urgent':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
          label: 'URGENT PRIORITY',
          desc: 'Targeted physical exam and diagnostic workup required promptly.',
        };
      default:
        return {
          bg: 'bg-[#0062FF]/20 text-blue-300 border-[#0062FF]/40',
          dot: 'bg-[#0062FF]',
          label: 'ROUTINE INTAKE',
          desc: 'Stable outpatient presentation; clinical intake in progress.',
        };
    }
  };

  const triageInfo = getTriageBadge();

  return (
    <div className="flex flex-col h-full rounded-2xl glass-panel border border-white/[0.08] overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/[0.06] bg-[#0A0E17]/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0062FF]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Live Clinical Extraction Feed
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <span className="text-[#0062FF] font-semibold">{allToolCalls.length}</span>
          <span>tool calls</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Triage Urgency Level Card */}
        <div className={`p-3.5 rounded-2xl border ${triageInfo.bg} transition-all`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${triageInfo.dot} animate-pulse`} />
              <span className="text-xs font-bold tracking-wider">{triageInfo.label}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wide opacity-80">
              Triage Stratification
            </span>
          </div>
          <p className="text-xs opacity-90 leading-relaxed">{triageInfo.desc}</p>
        </div>

        {/* Anatomical Spatial Mapping */}
        <AnatomicalMap
          activeLocations={activeLocations}
          hasEmergency={triageLevel === 'emergency'}
          selectedLocation={selectedLocation}
          onSelectLocation={(loc) => setSelectedLocation(loc === selectedLocation ? null : loc)}
        />

        {/* Active Red Flag Alerts */}
        {redFlags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-rose-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Red Flag Alerts ({redFlags.length})
              </span>
              <span className="text-[10px] font-mono">Priority Review</span>
            </div>

            <div className="space-y-2">
              {redFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs"
                >
                  <div className="font-semibold text-rose-200 mb-0.5">{flag.finding}</div>
                  <div className="text-slate-300 text-[11px] mb-1.5 leading-relaxed">
                    <span className="text-rose-400 font-medium">Rationale:</span> {flag.rationale}
                  </div>
                  <div className="text-[11px] text-rose-300/90 font-mono bg-rose-500/10 px-2 py-1 rounded">
                    ⚡ Stat Action: {flag.immediateRecommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extracted Symptoms */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-[#0062FF]" />
              Extracted Symptoms ({symptoms.length})
            </span>
            <span className="text-[10px] text-slate-500">Auto-Structured</span>
          </div>

          {symptoms.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-slate-500">
              Listening for patient symptom descriptions...
            </div>
          ) : (
            <div className="space-y-2.5">
              {symptoms.map((sym) => (
                <div
                  key={sym.id}
                  className="p-3 rounded-xl bg-[#101622] border border-white/[0.08] hover:border-[#0062FF]/50 transition-all text-xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-100 text-xs">{sym.name}</h4>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="capitalize">{sym.location}</span>
                        <span>·</span>
                        <span>Onset: {sym.onset}</span>
                      </div>
                    </div>
                    {/* Severity score */}
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">
                        {sym.severity}<span className="text-slate-500 text-[10px]">/10</span>
                      </span>
                    </div>
                  </div>

                  {/* Severity meter */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sym.severity >= 8
                          ? 'bg-rose-500'
                          : sym.severity >= 5
                          ? 'bg-amber-400'
                          : 'bg-[#0062FF]'
                      }`}
                      style={{ width: `${(sym.severity / 10) * 100}%` }}
                    />
                  </div>

                  {/* Character & Radiation details */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                    {sym.character && (
                      <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                        {sym.character}
                      </span>
                    )}
                    {sym.radiation && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        Radiates to: {sym.radiation}
                      </span>
                    )}
                    {sym.aggravatingOrRelieving && (
                      <span className="px-2 py-0.5 rounded bg-white/[0.04] text-slate-300">
                        {sym.aggravatingOrRelieving}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient Background & History */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-[#0062FF]" />
              Medical Background Profile
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#101622] border border-white/[0.08] space-y-2.5 text-xs">
            {/* Allergies */}
            <div>
              <div className="text-[10px] font-semibold text-rose-300 uppercase tracking-wider mb-1">
                Known Drug Allergies:
              </div>
              {history.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {history.allergies.map((alg, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[11px]"
                    >
                      {alg}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">NKDA (No known drug allergies reported)</span>
              )}
            </div>

            {/* Current Medications */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-1">
                Current Medications:
              </div>
              {history.medications.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {history.medications.map((med, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-200 border border-blue-500/20 text-[11px]"
                    >
                      {med}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">None logged yet</span>
              )}
            </div>

            {/* Chronic Conditions */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Past Medical Conditions:
              </div>
              {history.conditions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {history.conditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06] text-[11px]"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">No chronic comorbidities noted</span>
              )}
            </div>
          </div>
        </div>

        {/* Provisional Assessment Differentials */}
        {assessment && (
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0062FF]" />
                Provisional Impressions
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#101622] border border-white/[0.08] space-y-2 text-xs">
              <div className="font-medium text-slate-200 text-xs">
                {assessment.provisionalImpression}
              </div>

              {assessment.differentials && assessment.differentials.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {assessment.differentials.map((diff, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-[11px]"
                    >
                      <span className="font-medium text-slate-300">{diff.condition}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                          diff.probability === 'high'
                            ? 'bg-rose-500/20 text-rose-300'
                            : diff.probability === 'moderate'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {diff.probability}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
