import React from 'react';
import { BodyLocation } from '../types/clinical';

interface AnatomicalMapProps {
  activeLocations: BodyLocation[];
  hasEmergency: boolean;
  selectedLocation?: BodyLocation | null;
  onSelectLocation?: (location: BodyLocation) => void;
}

export const AnatomicalMap: React.FC<AnatomicalMapProps> = ({
  activeLocations,
  hasEmergency,
  selectedLocation,
  onSelectLocation,
}) => {
  const isLocationActive = (loc: BodyLocation) => activeLocations.includes(loc);

  const getColor = (loc: BodyLocation) => {
    const active = isLocationActive(loc);
    if (!active) return '#1A2333';
    return hasEmergency ? '#EF4444' : '#0062FF';
  };

  const getGlow = (loc: BodyLocation) => {
    const active = isLocationActive(loc);
    if (!active) return 'none';
    return hasEmergency ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.7))' : 'drop-shadow(0 0 10px rgba(0, 98, 255, 0.8))';
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-3 rounded-2xl bg-[#0B0F19]/60 border border-white/5">
      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between w-full px-1">
        <span>Anatomical Map</span>
        <span className="text-[10px] text-slate-500 font-mono">
          {activeLocations.length} active region{activeLocations.length !== 1 ? 's' : ''}
        </span>
      </div>

      <svg
        viewBox="0 0 160 260"
        className="w-36 h-56 select-none cursor-pointer"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="electricGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0062FF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0062FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Head */}
        <g
          onClick={() => onSelectLocation?.('head')}
          className="transition-all duration-300 hover:opacity-90"
          style={{ filter: getGlow('head') }}
        >
          <circle
            cx="80"
            cy="26"
            r="16"
            fill={getColor('head')}
            stroke={isLocationActive('head') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
          {isLocationActive('head') && (
            <circle cx="80" cy="26" r="20" fill="none" stroke="#0062FF" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" className="animate-spin origin-[80px_26px]" />
          )}
        </g>

        {/* Neck */}
        <g
          onClick={() => onSelectLocation?.('neck')}
          className="transition-all duration-300"
          style={{ filter: getGlow('neck') }}
        >
          <rect
            x="76"
            y="43"
            width="8"
            height="8"
            rx="2"
            fill={getColor('neck')}
            stroke={isLocationActive('neck') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Chest & Thorax */}
        <g
          onClick={() => onSelectLocation?.('chest')}
          className="transition-all duration-300"
          style={{ filter: getGlow('chest') }}
        >
          <path
            d="M 64 53 L 96 53 L 98 84 L 62 84 Z"
            fill={getColor('chest')}
            stroke={isLocationActive('chest') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
            rx="4"
          />
          {isLocationActive('chest') && (
            <circle cx="80" cy="68" r="4" fill="#ffffff" className="animate-ping opacity-75 origin-[80px_68px]" />
          )}
        </g>

        {/* Abdomen & Pelvis */}
        <g
          onClick={() => onSelectLocation?.('abdomen')}
          className="transition-all duration-300"
          style={{ filter: getGlow('abdomen') }}
        >
          <path
            d="M 63 87 L 97 87 L 94 122 L 66 122 Z"
            fill={getColor('abdomen')}
            stroke={isLocationActive('abdomen') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Pelvis / Groin */}
        <g
          onClick={() => onSelectLocation?.('pelvis')}
          className="transition-all duration-300"
          style={{ filter: getGlow('pelvis') }}
        >
          <path
            d="M 66 123 L 94 123 L 88 140 L 72 140 Z"
            fill={getColor('pelvis')}
            stroke={isLocationActive('pelvis') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Left Arm & Shoulder */}
        <g
          onClick={() => onSelectLocation?.('limbs')}
          className="transition-all duration-300"
          style={{ filter: getGlow('limbs') }}
        >
          <path
            d="M 60 55 L 42 95 L 36 142 L 42 143 L 50 98 L 62 64 Z"
            fill={getColor('limbs')}
            stroke={isLocationActive('limbs') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Right Arm & Shoulder */}
        <g
          onClick={() => onSelectLocation?.('limbs')}
          className="transition-all duration-300"
          style={{ filter: getGlow('limbs') }}
        >
          <path
            d="M 100 55 L 118 95 L 124 142 L 118 143 L 110 98 L 98 64 Z"
            fill={getColor('limbs')}
            stroke={isLocationActive('limbs') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Left Leg */}
        <g
          onClick={() => onSelectLocation?.('limbs')}
          className="transition-all duration-300"
          style={{ filter: getGlow('limbs') }}
        >
          <path
            d="M 70 142 L 67 195 L 65 242 L 74 242 L 77 195 L 78 142 Z"
            fill={getColor('limbs')}
            stroke={isLocationActive('limbs') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>

        {/* Right Leg */}
        <g
          onClick={() => onSelectLocation?.('limbs')}
          className="transition-all duration-300"
          style={{ filter: getGlow('limbs') }}
        >
          <path
            d="M 82 142 L 83 195 L 86 242 L 95 242 L 93 195 L 90 142 Z"
            fill={getColor('limbs')}
            stroke={isLocationActive('limbs') ? '#ffffff' : '#2A364E'}
            strokeWidth="1.5"
          />
        </g>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
        {(['head', 'chest', 'abdomen', 'limbs', 'back'] as BodyLocation[]).map((loc) => {
          const active = isLocationActive(loc);
          return (
            <span
              key={loc}
              onClick={() => onSelectLocation?.(loc)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer transition-all ${
                active
                  ? hasEmergency
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-[#0062FF]/20 text-blue-300 border border-[#0062FF]/40'
                  : 'bg-white/[0.03] text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {loc.toUpperCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
};
