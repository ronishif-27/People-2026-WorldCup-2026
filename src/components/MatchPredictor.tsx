import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Prediction } from '../types';
import { SmartGoalSelector } from './SmartGoalSelector';
import { CalendarDays, Save, ShieldAlert, Check, HelpCircle, Flame, Trophy, Award, Coins, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getMatchCoinsValue } from '../utils/scoring';

interface MatchPredictorProps {
  matches: Match[];
  predictions: Record<string, Prediction>;
  onSavePrediction: (matchId: string, scoreA: number, scoreB: number, firstGoalTime?: string) => void;
  isClosed: boolean; // True if countdown is past June 10th
  outrights: {
    topScorer: string;
    mostRedCards: string;
    timeFirstGoal: string;
    totalHeadedGoals: number | '';
  };
  onSaveOutrights: (updatedOutrights: {
    topScorer: string;
    mostRedCards: string;
    timeFirstGoal: string;
    totalHeadedGoals: number | '';
  }) => void;
}

export default function MatchPredictor({
  matches,
  predictions,
  onSavePrediction,
  isClosed,
  outrights,
  onSaveOutrights,
}: MatchPredictorProps) {
  // Local outrights state
  const [localOutrights, setLocalOutrights] = useState(outrights);

  useEffect(() => {
    setLocalOutrights(outrights);
  }, [outrights]);

  const handleLocalOutrightChange = (field: string, value: any) => {
    setLocalOutrights(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveTopScorer = () => {
    onSaveOutrights({ ...outrights, topScorer: localOutrights.topScorer });
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.8 }
    });
    setToastMessage("Top Scorer prediction saved successfully!");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveRedCards = () => {
    onSaveOutrights({ ...outrights, mostRedCards: localOutrights.mostRedCards });
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.8 }
    });
    setToastMessage("Most Red Cards prediction saved successfully!");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveHeadedGoals = () => {
    onSaveOutrights({ ...outrights, totalHeadedGoals: localOutrights.totalHeadedGoals });
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.8 }
    });
    setToastMessage("Total Headed Goals prediction saved successfully!");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  
  // Local score states for editing
  const [localScoreA, setLocalScoreA] = useState<number>(0);
  const [localScoreB, setLocalScoreB] = useState<number>(0);
  const [localFirstGoalTime, setLocalFirstGoalTime] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const startEditing = (match: Match) => {
    if (isClosed || match.status === 'LIVE' || match.status === 'FINISHED') return;
    const existing = predictions[match.id];
    setEditingMatchId(match.id);
    setLocalScoreA(existing ? existing.predictedScoreA : 0);
    setLocalScoreB(existing ? existing.predictedScoreB : 0);
    setLocalFirstGoalTime(existing?.firstGoalTime || '');
  };

  const saveLocalPrediction = (matchId: string, teamA: string, teamB: string) => {
    onSavePrediction(matchId, localScoreA, localScoreB, localFirstGoalTime);
    setEditingMatchId(null);
    
    // Play confetti explosion!
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });

    setToastMessage(`Prediction of ${localScoreA}-${localScoreB} for ${teamA} vs ${teamB} is saved!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper to filter matches according to selected stages
  const getSubmatches = () => {
    return matches.filter((m) => m.status === 'UPCOMING' || m.status === 'LIVE' || m.status === 'FINISHED');
  };

  // Helper to calculate mock/deterministic other users' predictions stats ("Most predicted winner")
  const getConsensusStats = (matchId: string) => {
    // If no one yet submitted (let's simulate m3 and m5 as unsubmitted)
    if (matchId === 'm3' || matchId === 'm5') {
      return {
        winA: 0,
        draw: 0,
        winB: 0,
        total: 0
      };
    }
    
    const charCodeSum = matchId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const winAPercent = 40 + (charCodeSum % 25);
    const drawPercent = 10 + (charCodeSum % 15);
    const winBPercent = 100 - winAPercent - drawPercent;
    
    return {
      winA: winAPercent,
      draw: drawPercent,
      winB: winBPercent,
      total: 100
    };
  };

  const visibleMatches = getSubmatches();

  return (
    <div className="space-y-6">
      {/* Informative Header card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#14665F] bg-[#14665F]/10 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
              Active Predictions Portal
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-2 tracking-tight">FIFA Group Stage Prediction</h3>
            <p className="text-slate-500 text-xs font-medium">
              Submit your prediction score tallies for upcoming World Cup matches before kickoff lockouts!
            </p>
          </div>
          {isClosed && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shrink-0 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
              Pre-Tournament Predictions are Closed!
            </div>
          )}
        </div>
      </div>

      {/* Toast Alert popup banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center gap-3 text-xs font-bold leading-none shadow-lg shadow-emerald-500/20"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-center">✓</div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* World Cup 2026 Outright Tournament Predictions */}
      <div className="py-2 space-y-4">
        <div className="border-b border-slate-150 pb-2">
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
            Bonus Specials (Optional)
          </span>
          <h3 className="text-base font-black text-slate-705 mt-1">World Cup 2026 Outright Predictions</h3>
          <p className="text-slate-500 text-[11px] font-normal">Predict the ultimate stats across the entire tournament</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-1">
          {/* Top Scorer Circle */}
          <div className="flex flex-col items-center justify-between text-center space-y-2.5 bg-slate-50 border border-slate-250 p-3.5 rounded-2xl min-h-[160px] sm:min-h-[175px]">
            <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1.5 w-full">
              <div className="w-11 h-11 rounded-full bg-amber-500/10 border-2 border-amber-500/60 flex items-center justify-center text-amber-600 shadow-xs relative shrink-0">
                <Trophy className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1 bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.2 rounded-full uppercase">Boot</span>
              </div>
              <div className="text-left sm:text-center flex-1 sm:max-w-[150px]">
                <h4 className="font-extrabold text-slate-800 text-xs line-clamp-1">Top Scorer</h4>
                <p className="text-[10px] text-slate-400">Most goals in active games</p>
              </div>
            </div>
            <div className="w-full flex flex-col items-center gap-1.5">
              <input
                type="text"
                placeholder="e.g. Kylian Mbappé..."
                value={localOutrights.topScorer || ''}
                onChange={(e) => handleLocalOutrightChange('topScorer', e.target.value)}
                disabled={isClosed}
                className="w-full max-w-[160px] text-center px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#14665F]"
              />
              {!isClosed && localOutrights.topScorer !== outrights.topScorer && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={saveTopScorer}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-[#14665F] text-white hover:bg-[#072C23] hover:shadow-sm rounded-full text-[8.5px] font-black tracking-wider uppercase cursor-pointer"
                >
                  <Save className="w-2.5 h-2.5" /> Save Selection
                </motion.button>
              )}
            </div>
          </div>

          {/* Team with Most Red Cards Circle */}
          <div className="flex flex-col items-center justify-between text-center space-y-2.5 bg-slate-50 border border-slate-250 p-3.5 rounded-2xl min-h-[160px] sm:min-h-[175px]">
            <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1.5 w-full">
              <div className="w-11 h-11 rounded-full bg-red-500/10 border-2 border-red-500/60 flex items-center justify-center text-red-650 shadow-xs relative shrink-0">
                <ShieldAlert className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[7px] font-black px-1.5 py-0.2 rounded-full uppercase">Cards</span>
              </div>
              <div className="text-left sm:text-center flex-1 sm:max-w-[150px]">
                <h4 className="font-extrabold text-slate-850 text-xs line-clamp-1">Most Red Cards</h4>
                <p className="text-[10px] text-slate-400">Prone country dismissals</p>
              </div>
            </div>
            <div className="w-full flex flex-col items-center gap-1.5">
              <input
                type="text"
                placeholder="e.g. Uruguay..."
                value={localOutrights.mostRedCards || ''}
                onChange={(e) => handleLocalOutrightChange('mostRedCards', e.target.value)}
                disabled={isClosed}
                className="w-full max-w-[160px] text-center px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#14665F]"
              />
              {!isClosed && localOutrights.mostRedCards !== outrights.mostRedCards && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={saveRedCards}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-[#14665F] text-white hover:bg-[#072C23] hover:shadow-sm rounded-full text-[8.5px] font-black tracking-wider uppercase cursor-pointer"
                >
                  <Save className="w-2.5 h-2.5" /> Save Selection
                </motion.button>
              )}
            </div>
          </div>

          {/* Total Headed Goals Circle */}
          <div className="flex flex-col items-center justify-between text-center space-y-2.5 bg-slate-50 border border-slate-250 p-3.5 rounded-2xl min-h-[160px] sm:min-h-[175px]">
            <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1.5 w-full">
              <div className="w-11 h-11 rounded-full bg-indigo-500/10 border-2 border-indigo-500/60 flex items-center justify-center text-indigo-650 shadow-xs relative shrink-0">
                <Award className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1 bg-indigo-500 text-white text-[7px] font-black px-1.5 py-0.2 rounded-full uppercase">Heads</span>
              </div>
              <div className="text-left sm:text-center flex-1 sm:max-w-[150px]">
                <h4 className="font-extrabold text-slate-850 text-xs line-clamp-1">Headed Goals</h4>
                <p className="text-[10px] text-slate-400">Header goals count</p>
              </div>
            </div>
            <div className="w-full flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isClosed) return;
                    const val = Number(localOutrights.totalHeadedGoals || 0);
                    handleLocalOutrightChange('totalHeadedGoals', Math.max(0, val - 1));
                  }}
                  disabled={isClosed}
                  className="w-6 h-6 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-full cursor-pointer transition-all border border-slate-200 text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  value={localOutrights.totalHeadedGoals === 0 ? 0 : localOutrights.totalHeadedGoals || ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                    handleLocalOutrightChange('totalHeadedGoals', val);
                  }}
                  disabled={isClosed}
                  placeholder="0"
                  className="w-10 py-0.5 bg-white border border-slate-200 text-center text-xs font-mono font-black rounded-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isClosed) return;
                    const val = Number(localOutrights.totalHeadedGoals || 0);
                    handleLocalOutrightChange('totalHeadedGoals', val + 1);
                  }}
                  disabled={isClosed}
                  className="w-6 h-6 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-full cursor-pointer transition-all border border-slate-200 text-xs"
                >
                  +
                </button>
              </div>
              {!isClosed && localOutrights.totalHeadedGoals !== outrights.totalHeadedGoals && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={saveHeadedGoals}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-[#14665F] text-white hover:bg-[#072C23] hover:shadow-sm rounded-full text-[8.5px] font-black tracking-wider uppercase cursor-pointer"
                >
                  <Save className="w-2.5 h-2.5" /> Save Selection
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match cards */}
      <div className="grid grid-cols-1 gap-6">
        {visibleMatches.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border text-slate-400 font-bold max-w-lg mx-auto w-full">
            <HelpCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No matches match this stage filter right now.</p>
            <p className="text-xs font-medium text-slate-400 mt-1">Check back soon or create matches in the Admin tab configuration!</p>
          </div>
        ) : (
          visibleMatches.map((match, idx) => {
            const currentPred = predictions[match.id];
            const isEditing = editingMatchId === match.id;

            // BDP - Game not yet scheduled state
            const isNotScheduled = !match.date || match.date === '' || match.date.toLowerCase().includes('tbd') || match.teamA.toLowerCase().includes('tbd') || match.teamA.toLowerCase().includes('winner') || match.teamB.toLowerCase().includes('winner');

            if (isNotScheduled) {
              return (
                <div 
                  key={match.id || `not-sched-${idx}`}
                  className="bg-slate-50/75 border border-dashed border-slate-250 rounded-3xl p-6 text-center select-none space-y-2.5 transition-all duration-300"
                >
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#14665F]">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">BDP - Matchup To Be Scheduled</p>
                    <p className="text-[11px] text-slate-400 font-medium">This card is a standby placeholder. When teams qualify or dates are finalized, predictions will immediately unlock for all users.</p>
                  </div>
                </div>
              );
            }

            // Compute consensus percentage indices for this match
            const stats = getConsensusStats(match.id);

            // True if game started already (Live or Finished)
            const isGameStarted = match.status === 'LIVE' || match.status === 'FINISHED';

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={match.id}
                className="bg-white border border-slate-200 shadow-sm hover:shadow-md rounded-3xl overflow-hidden transition-all duration-300"
                id={`match-item-${match.id}`}
              >
                {/* INLINE DATE & VENUE COMPLIANT HEADER BAND */}
                <div className="bg-slate-50/95 px-3.5 py-1.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-[10px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1.5 uppercase tracking-wide">
                    <CalendarDays className="w-3.5 h-3.5 text-[#14665F]/80 shrink-0" />
                    <span>{match.date} • {match.time} • <span className="text-slate-400 font-normal">{match.venue}, {match.city}</span></span>
                  </span>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-black uppercase text-[#14665F] tracking-wider bg-[#14665F]/10 px-2 py-0.5 rounded">
                      {match.stage || 'Group Stage'}
                    </span>
                    {match.status === 'LIVE' && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase text-red-500 animate-pulse bg-red-100/50 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Live Game {match.minute ? `• ${match.minute}` : ''}
                      </span>
                    )}
                    <span className="bg-amber-500/10 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-0.5 select-none font-mono">
                      {getMatchCoinsValue(match)}
                      <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row">
                  {/* Left Column: Team matchup details */}
                  <div className="p-6 md:w-5/12 bg-slate-50/30 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100">
                    {/* STATE 1: Upcoming and NOT predicted yet -> NO PLACEHOLDER SCORES, just plain Team VS Team matchup */}
                    {!currentPred && !isGameStarted ? (
                      <div className="flex flex-col items-center justify-center space-y-3 py-3">
                        <div className="flex items-center justify-center gap-4 py-2">
                          {/* Team A */}
                          <div className="flex flex-col items-center text-center w-[90px]">
                            <span className="text-4xl mb-1.5 filter drop-shadow-sm select-none">{match.flagA}</span>
                            <span className="text-xs font-black text-slate-800 truncate w-full">{match.teamA}</span>
                          </div>

                          <span className="text-xs font-black text-slate-400/90 tracking-widest px-2.5 py-1 bg-slate-100 border border-slate-205 rounded-full uppercase scale-95 select-none">VS</span>

                          {/* Team B */}
                          <div className="flex flex-col items-center text-center w-[90px]">
                            <span className="text-4xl mb-1.5 filter drop-shadow-sm select-none">{match.flagB}</span>
                            <span className="text-xs font-black text-slate-800 truncate w-full">{match.teamB}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Group Tally Matchup</p>
                      </div>
                    ) : (
                      // Otherwise show actual game score or live state
                      <div className="flex flex-col items-center justify-center space-y-3 py-3">
                        <div className="flex items-center justify-between gap-4 py-2 w-full max-w-[260px] mx-auto">
                          {/* Team A */}
                          <div className="flex flex-col items-center text-center w-[90px]">
                            <span className="text-4xl mb-1.5 filter drop-shadow-sm select-none">{match.flagA}</span>
                            <span className="text-xs font-black text-slate-800 truncate w-full">{match.teamA}</span>
                          </div>

                          {/* Real Match Score if Started */}
                          <div className="flex flex-col items-center justify-center min-w-[70px]">
                            {isGameStarted ? (
                              <span className="font-mono text-xl font-black text-slate-850 px-3 py-1 bg-slate-200/50 rounded-xl tracking-tight border border-slate-200 select-none whitespace-nowrap inline-flex items-center justify-center gap-1">
                                <span>{match.scoreA ?? 0}</span>
                                <span className="text-slate-405 font-extrabold">:</span>
                                <span>{match.scoreB ?? 0}</span>
                              </span>
                            ) : (
                              <span className="text-xs bg-slate-200 text-slate-500 font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest select-none">
                                VS
                              </span>
                            )}
                          </div>

                          {/* Team B */}
                          <div className="flex flex-col items-center text-center w-[90px]">
                            <span className="text-4xl mb-1 filter drop-shadow-sm select-none">{match.flagB}</span>
                            <span className="text-xs font-black text-slate-800 truncate w-full">{match.teamB}</span>
                          </div>
                        </div>
                        {isGameStarted && (
                          <span className="text-[10px] font-extrabold text-[#14665F] uppercase tracking-wider block">Official Result</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Dynamic Interactive Prediction Block */}
                  <div className="flex-1 p-6 flex flex-col justify-center bg-white min-h-[190px] space-y-4">
                    {!isEditing ? (
                      <div className="text-center md:text-left space-y-4">
                        
                        {/* STATE 1: Available & open, NOT yet predicted */}
                        {!currentPred && !isGameStarted && (
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-sm font-black text-[#14665F] uppercase tracking-wider mb-1">
                                Predict the Score
                              </h4>
                              <p className="text-xs text-slate-400 font-semibold leading-tight">
                                Cast your forecast below on the correct final score and exact first goal time bracket!
                              </p>
                            </div>

                            {/* Guesty Consensus (with 0% same-color support if empty submissions) */}
                            <div className="space-y-1.5 border-t pt-2.5">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                                Guesty Consensus Forecast Stats
                              </p>
                              {stats.total === 0 ? (
                                <div className="space-y-1">
                                  <div className="flex h-3 px-3 rounded-full overflow-hidden bg-slate-100 text-[8px] font-black text-slate-400 text-center items-center justify-center border border-slate-150">
                                    No submissions yet • Cast yours now!
                                  </div>
                                  <div className="flex justify-between text-[8px] font-bold text-slate-450 uppercase mt-0.5">
                                    <span className="text-slate-400">0% {match.teamA} Win</span>
                                    <span className="text-slate-400">0% Draw</span>
                                    <span className="text-slate-400">0% {match.teamB} Win</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 text-[8px] font-bold text-white text-center">
                                    <div 
                                      className="bg-[#14665F] flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.winA}%` }} 
                                    >
                                      {stats.winA}%
                                    </div>
                                    <div 
                                      className="bg-slate-400 flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.draw}%` }} 
                                    >
                                      {stats.draw}%
                                    </div>
                                    <div 
                                      className="bg-[#072C23] flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.winB}%` }} 
                                    >
                                      {stats.winB}%
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span>{match.teamA} Win ({stats.winA}%)</span>
                                    <span>Draw ({stats.draw}%)</span>
                                    <span>{match.teamB} Win ({stats.winB}%)</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => startEditing(match)}
                              disabled={isClosed}
                              className="w-full md:w-auto px-5 py-2.5 bg-[#14665F] text-white hover:bg-[#072C23] font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200 select-none shadow-sm cursor-pointer"
                            >
                              Predict Score
                            </button>
                          </div>
                        )}

                        {/* STATE 2: Open and user HAS predicted */}
                        {currentPred && !isGameStarted && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h4 className="text-xs font-black text-[#14665F] uppercase tracking-wider">
                                  Your Saved Prediction
                                </h4>
                              </div>
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-150 flex items-center gap-0.5 shrink-0 select-none">
                                <Check className="w-3.5 h-3.5" /> Saved
                              </span>
                            </div>

                            {/* Prediction Display Box */}
                            <div className="p-4 bg-emerald-50/20 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center space-y-2">
                              {/* Predicted Score Between Groups */}
                              <div className="font-extrabold text-slate-900 flex items-center justify-center gap-3">
                                <span className="text-xs font-black text-slate-500 uppercase">{match.teamA}</span>
                                <span className="bg-[#14665F] text-white px-3 py-1 rounded-xl font-mono text-xl tracking-wide shadow-md">
                                  {currentPred.predictedScoreA}
                                </span>
                                <span className="text-slate-350 font-black">-</span>
                                <span className="bg-[#14665F] text-white px-3 py-1 rounded-xl font-mono text-xl tracking-wide shadow-md">
                                  {currentPred.predictedScoreB}
                                </span>
                                <span className="text-xs font-black text-slate-500 uppercase">{match.teamB}</span>
                              </div>

                              {/* Time of first goal */}
                              {currentPred.firstGoalTime && (
                                <p className="text-[11px] font-black text-slate-600 flex items-center justify-center gap-1 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 mt-1">
                                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10" /> Goal Time Bracket: <span className="text-[#14665F]">{currentPred.firstGoalTime}</span>
                                </p>
                              )}

                              <div className="text-[10.5px] font-extrabold text-amber-600 flex items-center justify-center gap-1 select-none pt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Change this prediction at any point before kickoff.
                              </div>
                            </div>

                            {/* Guesty Consensus in State 2 */}
                            <div className="space-y-1 border-t pt-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                                Guesty Consensus Forecast Stats
                              </p>
                              {stats.total === 0 ? (
                                <div className="flex h-3 px-3 rounded-full overflow-hidden bg-slate-100 text-[8px] font-black text-slate-400 text-center items-center justify-center border border-slate-150">
                                  No submissions yet • Cast yours now!
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 text-[8px] font-bold text-white text-center">
                                    <div className="bg-[#14665F] flex items-center justify-center" style={{ width: `${stats.winA}%` }}>{stats.winA}%</div>
                                    <div className="bg-slate-400 flex items-center justify-center" style={{ width: `${stats.draw}%` }}>{stats.draw}%</div>
                                    <div className="bg-[#072C23] flex items-center justify-center" style={{ width: `${stats.winB}%` }}>{stats.winB}%</div>
                                  </div>
                                  <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span>{match.teamA} Win ({stats.winA}%)</span>
                                    <span>Draw ({stats.draw}%)</span>
                                    <span>{match.teamB} Win ({stats.winB}%)</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => startEditing(match)}
                              disabled={isClosed}
                              className="w-full md:w-auto px-5 py-2 bg-[#14665F]/10 text-[#14665F] hover:bg-[#14665F]/20 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200 border border-[#14665F]/20 cursor-pointer"
                            >
                              Edit Prediction
                            </button>
                          </div>
                        )}

                        {/* STATE 3: Game Started (Live or Finished) -> FULLY LOCKED */}
                        {isGameStarted && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider">
                                Predictions Locked
                              </h4>
                            </div>

                            {/* Displays users prediction if any */}
                            {currentPred ? (
                              <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-200 space-y-1.5 text-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Your Lodged Guess</span>
                                <div className="font-extrabold text-slate-700 items-center justify-center gap-2 flex text-xs">
                                  <span>{match.teamA}</span>
                                  <span className="bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-mono text-sm">{currentPred.predictedScoreA}</span>
                                  <span>-</span>
                                  <span className="bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-mono text-sm">{currentPred.predictedScoreB}</span>
                                  <span>{match.teamB}</span>
                                </div>
                                {currentPred.firstGoalTime && (
                                  <span className="text-[10px] block font-semibold text-slate-500">First Goal Guess: {currentPred.firstGoalTime}</span>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-center">
                                <p className="text-slate-400 text-xs font-bold italic">
                                  You did not lodge predictions for this match before kickoff.
                                </p>
                              </div>
                            )}

                            {/* Consensus recap for started games */}
                            <div className="space-y-1.5 border-t pt-2.5">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Consensus stats record</p>
                              {stats.total > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 text-[8px] font-bold text-white text-center">
                                    <div 
                                      className="bg-[#14665F]/60 flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.winA}%` }} 
                                    >
                                      {stats.winA}%
                                    </div>
                                    <div 
                                      className="bg-slate-400 flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.draw}%` }} 
                                    >
                                      {stats.draw}%
                                    </div>
                                    <div 
                                      className="bg-[#072C23]/60 flex items-center justify-center transition-all duration-300" 
                                      style={{ width: `${stats.winB}%` }} 
                                    >
                                      {stats.winB}%
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span>{match.teamA} Win ({stats.winA}%)</span>
                                    <span>Draw ({stats.draw}%)</span>
                                    <span>{match.teamB} Win ({stats.winB}%)</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[9px] text-slate-400 italic font-semibold">No consensus submissions lodged.</div>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    ) : (
                      // Interactive editing form
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            Editing Score Forecast
                          </span>
                          <button
                            onClick={() => setEditingMatchId(null)}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Touch selectors */}
                        <div className="grid grid-cols-2 gap-4">
                          <SmartGoalSelector
                            teamName={match.teamA}
                            flag={match.flagA}
                            value={localScoreA}
                            onChange={setLocalScoreA}
                          />
                          <SmartGoalSelector
                            teamName={match.teamB}
                            flag={match.flagB}
                            value={localScoreB}
                            onChange={setLocalScoreB}
                          />
                        </div>

                        {/* Game-specific Spec: Time of First Goal in the Match */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className="text-[11px] font-black text-[#14665F] uppercase tracking-wider flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-500 fill-orange-500/10" /> Time of First Goal
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(Match-Specific Spec)</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1.5">
                            {['1 - 15\'', '16 - 30\'', '31 - 45\'', '46 - 60\'', '61 - 75\'', '76 - 90+\''].map((range) => {
                              const isSelected = localFirstGoalTime === range;
                              return (
                                <button
                                  key={range}
                                  type="button"
                                  onClick={() => setLocalFirstGoalTime(range)}
                                  className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all border ${
                                    isSelected
                                      ? 'bg-[#14665F] text-white border-[#14665F] shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {range}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Save Trigger CTA */}
                        <div className="pt-2 flex gap-3">
                          <button
                            onClick={() => saveLocalPrediction(match.id, match.teamA, match.teamB)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#14665F] text-white hover:bg-[#072C23] rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            Save Forecast
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
