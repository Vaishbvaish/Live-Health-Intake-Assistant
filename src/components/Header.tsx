import React from 'react';
import { Activity, ShieldAlert, FileText, Sparkles, Mic } from 'lucide-react';
import { TriageUrgency } from '../types/clinical';

interface HeaderProps {
  activeView: 'intake' | 'handoff';
  setActiveView: (view: 'intake' | 'handoff') => void;
  triageLevel: TriageUrgency;
  extractedSymptomCount: number;
  redFlagCount: number;
  sessionDuration: string;
  hasHandoff: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  triageLevel,
  extractedSymptomCount,
  redFlagCount,
  sessionDuration,
  hasHandoff,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#07090E]/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0048C4] to-[#0062FF] flex items-center justify-center shadow-lg shadow-[#0062FF]/20 border border-white/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold tracking-tight text-white font-mono">NSOFFICE.AI</span>
              <span className="text-slate-500 text-xs">/</span>
              <span className="text-xs font-semibold text-slate-300">Healthcare</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Live Health Intake Assistant
            </div>
          </div>
        </div>

        {/* Live Session Status */}
        <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-[#0062FF] animate-pulse" />
            <span className="font-mono text-[11px] text-slate-300">{sessionDuration}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{extractedSymptomCount} symptoms</span>
          </div>

          {redFlagCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{redFlagCount} Alert{redFlagCount !== 1 ? 's' : ''} Flagged</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-[#0062FF]/30 text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-[#0062FF]" />
              <span>Real-time Gemini Tool Calling</span>
            </div>
          )}
        </div>

        {/* View Switcher / Primary Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => setActiveView('intake')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'intake'
                  ? 'bg-[#0062FF] text-white shadow-md shadow-[#0062FF]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Voice Intake</span>
            </button>

            <button
              onClick={() => setActiveView('handoff')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'handoff'
                  ? 'bg-[#0062FF] text-white shadow-md shadow-[#0062FF]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Doctor Handoff</span>
              {hasHandoff && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
