import React from 'react';

interface GuestyLogoProps {
  className?: string;
  iconOnly?: boolean;
  color?: string; // Standard is Guesty Nature #14665F
}

export default function GuestyLogo({ className = 'h-8', iconOnly = false, color = '#14665F' }: GuestyLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Guesty Iconic House Symbol with rounded pathing */}
      <svg
        viewBox="0 0 44 48"
        className="h-full w-auto select-none shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22 2L2 17.5V39.5C2 41.71 3.79 43.5 6 43.5H38C40.21 43.5 42 41.71 42 39.5V17.5L22 2Z"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 35.5V23.5C13.5 21.3 15.3 19.5 17.5 19.5H26.5C28.7 19.5 30.5 21.3 30.5 23.5V35.5"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Guesty Wordmark rendered as premium vectors for sharpness */}
      {!iconOnly && (
        <span 
          style={{ color }}
          className="font-sans font-black tracking-tight text-xl md:text-2xl select-none flex items-center gap-0.5"
        >
          <span>Guesty</span>
          <span className="text-orange-500 text-xs font-bold font-mono tracking-widest align-super ml-1 opacity-80 uppercase">
            Predicts
          </span>
        </span>
      )}
    </div>
  );
}
