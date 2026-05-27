import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, HelpCircle, Flame, Clock, ArrowRight, Sparkles, CheckCircle, ShieldAlert, Award } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  // Phase 1 is 'WELCOME', Phase 2 is 'GAMBLING_RULES'
  const [phase, setPhase] = useState<'WELCOME' | 'BETTING_RULES'>('WELCOME');
  const [bettingStep, setBettingStep] = useState(0);

  const welcomeSteps = [
    {
      title: "Predict Exact Scores",
      desc: "For each matchup, enter your estimated goals for both teams rather than just guessing generic wins.",
      icon: Trophy,
      color: "text-[#14665F] bg-[#14665F]/10",
    },
    {
      title: "Observe Lockout Deadline",
      desc: "Predictions lock strictly on June 10th. Make sure to complete all submissions before the countdown clock hits zero.",
      icon: ShieldAlert,
      color: "text-rose-600 bg-rose-100",
    },
    {
      title: "Climb the Global Board",
      desc: "Show off your expertise, rise through the Guesty ranks, and lift your department or site to international glory.",
      icon: Sparkles,
      color: "text-[#072C23] bg-[#072C23]/10",
    },
  ];

  const bettingRulesSteps = [
    {
      title: "Step 1: Predict & Score",
      subtitle: "The Coin & Point Rewards",
      desc: "Earn points and coins by guessing exact scores correctly. Strong strategic predictions boost your standings, while precise goal-timing earns extra bonus awards to climb the leaderboard!",
      badge: "SCORES",
      icon: Award,
      color: "from-amber-500 to-yellow-400",
    },
    {
      title: "Step 2: First Goal Specials",
      subtitle: "Game-Specific Outrights",
      desc: "For each match you forecast, submit the predicted interval of the First Goal (e.g., 1-15', 76-90+'). This outright prediction is match-specific to keep your strategy hyper-focused!",
      badge: "SPECIALS",
      icon: Clock,
      color: "from-[#14665F] to-[#8CBEBE]",
    },
    {
      title: "Step 3: Win Department Standing",
      subtitle: "Inter-Office Rivalry",
      desc: "Your score dynamically feeds into your department's and office site's overall score. Help your local team beat New York, Kyiv, or Barcelona!",
      badge: "GLORY",
      icon: Flame,
      color: "from-[#072C23] to-[#14665F]",
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 overflow-y-auto">
      <AnimatePresence mode="wait">
        {phase === 'WELCOME' ? (
          <motion.div
            key="welcome-phase"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden my-auto border-t-4 border-[#14665F]"
            id="welcome-modal"
          >
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#14665F]/5 blur-3xl rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#072C23]/5 blur-3xl rounded-full" />

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-[#14665F] rounded-2xl flex items-center justify-center shadow-lg shadow-[#14665F]/30 mb-4 animate-bounce">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#14665F] tracking-tight">
                Guesty World Cup <span className="text-[#072C23]">2026</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-semibold">
                Global Office Prediction Hub
              </p>
            </div>

            {/* 3 Steps */}
            <div className="space-y-5 relative z-10 mb-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center border-b pb-2">
                How the Game Works (3 Steps)
              </h3>
              {welcomeSteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={idx} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className={`p-3 rounded-xl shrink-0 ${step.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <span className="text-[#14665F] font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">0{idx+1}</span>
                        {step.title}
                      </h4>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed font-medium">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <button
              onClick={() => setPhase('BETTING_RULES')}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#14665F] text-white hover:bg-[#072C23] rounded-2xl font-bold tracking-wide transition-all duration-300 shadow-lg shadow-[#14665F]/20 transform active:scale-95 group text-sm md:text-base cursor-pointer"
              id="btn-start-now"
            >
              Start Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="betting-phase"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden my-auto border-t-4 border-[#072C23]"
            id="betting-modal"
          >
            {/* Theme header dots */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#14665F] via-[#072C23] to-[#FA877D]" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-6">
              <div>
                <span className="text-[10px] font-bold text-[#14665F] bg-[#14665F]/10 px-2.5 py-1 rounded select-none">FORECAST RULES</span>
                <h3 className="text-base sm:text-lg font-black text-slate-800 mt-1.5 tracking-tight">Prediction Hub Onboarding</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400 shrink-0">Step {bettingStep + 1} of 3</span>
            </div>

            {/* Current card slider style */}
            <div className="min-h-[220px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={bettingStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-4 rounded-2xl text-white bg-gradient-to-tr ${bettingRulesSteps[bettingStep].color} shadow-md`}>
                      {(() => {
                        const Icon = bettingRulesSteps[bettingStep].icon;
                        return <Icon className="w-6 h-6 animate-pulse" />;
                      })()}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-[#14665F] uppercase tracking-widest bg-[#14665F]/10 px-2 py-0.5 rounded">
                        {bettingRulesSteps[bettingStep].badge}
                      </span>
                      <h4 className="text-lg font-extrabold text-slate-900 leading-tight mt-1">
                        {bettingRulesSteps[bettingStep].title}
                      </h4>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-500 italic">
                    {bettingRulesSteps[bettingStep].subtitle}
                  </p>
                  <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium">
                    {bettingRulesSteps[bettingStep].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pagination indicators */}
            <div className="flex justify-center gap-2 mt-6 mb-6">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setBettingStep(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    bettingStep === i ? 'w-8 bg-[#14665F]' : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Navigation button */}
            <div className="flex gap-3">
              {bettingStep > 0 && (
                <button
                  onClick={() => setBettingStep((prev) => prev - 1)}
                  className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-sm cursor-pointer"
                >
                  Back
                </button>
              )}
              {bettingStep < 2 ? (
                <button
                  onClick={() => setBettingStep((prev) => prev + 1)}
                  className="flex-1 py-3 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onComplete}
                  className="flex-1 py-3 bg-[#14665F] text-white hover:bg-[#072C23] rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
                  id="btn-complete-onboarding"
                >
                  Let's Begin!
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
