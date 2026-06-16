import { useState, useEffect } from 'react';
import { Timer, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface CountdownClockProps {
  onDeadlineReached: (isReached: boolean) => void;
  onPredictClick?: () => void;
}

export function CountdownClock({ onDeadlineReached, onPredictClick }: CountdownClockProps) {
  // Target date is June 10th, 2026 00:00:00 UTC
  const targetDate = new Date('2026-06-10T00:00:00Z').getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        onDeadlineReached(true);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft(); // initial run
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onDeadlineReached]);

  return (
    <div className={`rounded-3xl p-6 border text-white shadow-lg overflow-hidden relative ${
      timeLeft.isExpired
        ? 'bg-gradient-to-r from-red-600 via-red-700 to-rose-800 border-red-500'
        : 'bg-gradient-to-r from-[#072C23] via-[#14665F] to-[#101010] border-nature/20'
    }`}>
      {/* Decorative pulse blur glow */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-teal/15 blur-[90px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#FA877D]/15 blur-[90px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left space-y-2">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-teal animate-ping shrink-0" />
            <span className="text-xs font-bold text-teal uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 fill-teal/25" /> June 10th Hub Clock
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight leading-none text-white flex items-center gap-2 justify-center md:justify-start">
            {timeLeft.isExpired ? (
              <>Predictions Are Locked</>
            ) : (
              <>Pre-Tournament Prediction Deadline</>
            )}
          </h2>
          <p className="text-cream/70 text-xs font-medium max-w-sm">
            {timeLeft.isExpired
              ? 'Locks are active. No predictions can be inputted or modified. Matches are live.'
              : 'Add predictions for the initial matchups before the countdown terminates to earn correct guess points.'}
          </p>
          {!timeLeft.isExpired && onPredictClick && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onPredictClick}
                className="bg-[#FA877D] text-[#072C23] hover:bg-[#EEFAD0] hover:text-[#072C23] px-6 py-2.5 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md inline-flex items-center gap-1.5 uppercase tracking-widest"
              >
                Predict
              </button>
            </div>
          )}
        </div>

        {/* Stadium Scoreboard Clock layout */}
        <div className="flex items-center gap-2 font-mono">
          {timeLeft.isExpired ? (
            <div className="flex items-center gap-2 bg-black/40 px-6 py-3 rounded-2xl border border-red-500 text-red-400">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-sm font-black uppercase tracking-widest">CLOSED & ACCESS DENIED</span>
            </div>
          ) : (
            <>
              {/* Days */}
              <div className="flex flex-col items-center">
                <div className="bg-black/50 border border-white/10 text-white min-w-[56px] px-3 py-2 rounded-2xl text-center shadow-inner">
                  <span className="text-2xl font-black tracking-wide block leading-none">
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1">Days</span>
              </div>

              <span className="text-xl font-bold text-white/20 -mt-5 block">:</span>

              {/* Hours */}
              <div className="flex flex-col items-center">
                <div className="bg-black/50 border border-white/10 text-white min-w-[56px] px-3 py-2 rounded-2xl text-center shadow-inner">
                  <span className="text-2xl font-black tracking-wide block leading-none">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1">Hrs</span>
              </div>

              <span className="text-xl font-bold text-white/20 -mt-5 block">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center">
                <div className="bg-black/50 border border-white/10 text-white min-w-[56px] px-3 py-2 rounded-2xl text-center shadow-inner">
                  <span className="text-2xl font-black tracking-wide block leading-none">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1">Mins</span>
              </div>

              <span className="text-xl font-bold text-white/20 -mt-5 block">:</span>

              {/* Seconds */}
              <div className="flex flex-col items-center">
                <div className="bg-black/50 border border-white/10 text-white min-w-[56px] px-3 py-2 rounded-2xl text-center shadow-inner text-emerald-400">
                  <span className="text-2xl font-black tracking-wide block leading-none animate-pulse">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1">Secs</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
