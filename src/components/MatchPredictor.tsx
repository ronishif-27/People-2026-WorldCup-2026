import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Prediction } from '../types';
import { CalendarDays, Save, ShieldAlert, HelpCircle, Flame, Trophy, Award, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getMatchCoinsValue } from '../utils/scoring';

// ─── Label helpers ────────────────────────────────────────────────────────────

/** Removes underscores and title-cases any internal key: GROUP_STAGE → Group Stage */
function formatLabel(str: string): string {
  return str
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Specific stage display names */
function formatStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE:   'Group Stage',
    ROUND_OF_32:   'Round of 32',
    ROUND_OF_16:   'Round of 16',
    QUARTERFINALS: 'Quarter Finals',
    SEMIFINALS:    'Semi Finals',
    FINAL:         'Final',
  };
  return map[stage] ?? formatLabel(stage);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatchPredictorProps {
  matches: Match[];
  predictions: Record<string, Prediction>;
  onSavePrediction: (matchId: string, scoreA: number, scoreB: number, firstGoalTime?: string) => void;
  isClosed: boolean;
  authToken: string;
  outrights: {
    topScorer: string;
    mostRedCards: string;
    timeFirstGoal: string;
    totalHeadedGoals: number | '';
  };
  onSaveOutrights: (o: {
    topScorer: string;
    mostRedCards: string;
    timeFirstGoal: string;
    totalHeadedGoals: number | '';
  }) => void;
}

interface ConsensusStats { winA: number; draw: number; winB: number; }

const API_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Spinner-style score selector ─────────────────────────────────────────────

function ScoreSpinner({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.min(value + 1, 20))}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-[#14665F]/10 text-slate-600 hover:text-[#14665F] transition-colors cursor-pointer"
      >
        <ChevronUp className="w-4 h-4 stroke-[3]" />
      </button>
      <span className="text-3xl font-black font-mono text-slate-900 w-10 text-center leading-none py-1">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.max(value - 1, 0))}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-[#14665F]/10 text-slate-600 hover:text-[#14665F] transition-colors cursor-pointer"
      >
        <ChevronDown className="w-4 h-4 stroke-[3]" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MatchPredictor({
  matches,
  predictions,
  onSavePrediction,
  isClosed,
  authToken,
  outrights,
  onSaveOutrights,
}: MatchPredictorProps) {
  const [localOutrights, setLocalOutrights] = useState(outrights);
  useEffect(() => { setLocalOutrights(outrights); }, [outrights]);

  // ── Real consensus data from API ──────────────────────────────────────────
  const [consensusMap, setConsensusMap] = useState<Record<string, ConsensusStats>>({});

  useEffect(() => {
    const upcoming = matches.filter(m => m.status === 'UPCOMING' || m.status === 'LIVE');
    upcoming.forEach(async (m) => {
      try {
        const res = await fetch(`${API_URL}/api/predictions/${m.id}/consensus`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        // Backend returns { winA, draw, winB } as percentages
        setConsensusMap(prev => ({
          ...prev,
          [m.id]: {
            winA: data.winA ?? data.winAPercent ?? 33,
            draw: data.draw ?? data.drawPercent ?? 34,
            winB: data.winB ?? data.winBPercent ?? 33,
          },
        }));
      } catch { /* ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, authToken]);

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [localScoreA, setLocalScoreA]       = useState(0);
  const [localScoreB, setLocalScoreB]       = useState(0);
  const [localFirstGoal, setLocalFirstGoal] = useState('');
  const [toastMessage, setToastMessage]     = useState<string | null>(null);

  const startEditing = (match: Match) => {
    if (isClosed) return;
    const existing = predictions[match.id];
    setEditingMatchId(match.id);
    setLocalScoreA(existing?.predictedScoreA ?? 0);
    setLocalScoreB(existing?.predictedScoreB ?? 0);
    setLocalFirstGoal(existing?.firstGoalTime ?? '');
  };

  const saveLocalPrediction = (matchId: string, teamA: string, teamB: string) => {
    onSavePrediction(matchId, localScoreA, localScoreB, localFirstGoal);
    setEditingMatchId(null);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setToastMessage(`Prediction saved: ${teamA} ${localScoreA} – ${localScoreB} ${teamB}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const saveOutrightsAction = () => {
    onSaveOutrights(localOutrights);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setToastMessage('Tournament outright predictions saved!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const visibleMatches = matches.filter(
    (m) => m.status === 'UPCOMING' || m.status === 'LIVE'
  );

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#14665F] bg-[#14665F]/10 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
              Active Predictions Portal
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-2 tracking-tight">
              FIFA World Cup 2026 — Predictions
            </h3>
            <p className="text-slate-500 text-xs font-medium">
              Submit your score forecast for each match before kickoff.
            </p>
          </div>
          {isClosed && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shrink-0">
              <ShieldAlert className="w-5 h-5" />
              Predictions are Closed
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center gap-3 text-xs font-bold shadow-lg shadow-emerald-500/20"
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">✓</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Outright specials ───────────────────────────────────────────────── */}
      <div className="py-2 space-y-4">
        <div className="border-b border-slate-150 pb-2">
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
            Bonus Specials (Optional)
          </span>
          <h3 className="text-base font-black text-slate-700 mt-1">World Cup 2026 Outright Predictions</h3>
          <p className="text-slate-500 text-[11px]">Predict the ultimate stats across the entire tournament</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2">
          {/* Top Scorer */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center text-amber-600 relative">
              <Trophy className="w-7 h-7" />
              <span className="absolute -top-1.5 -right-1 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">Boot</span>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs">Top Scorer (Golden Boot)</h4>
              <p className="text-[10px] text-slate-400">Most goals in the tournament</p>
            </div>
            <input
              type="text"
              placeholder="e.g. Kylian Mbappé…"
              value={localOutrights.topScorer || ''}
              onChange={(e) => setLocalOutrights((p) => ({ ...p, topScorer: e.target.value }))}
              disabled={isClosed}
              className="w-full max-w-[170px] text-center px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#14665F]"
            />
          </div>

          {/* Most Red Cards */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center text-red-600 relative">
              <ShieldAlert className="w-7 h-7" />
              <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">Cards</span>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs">Most Red Cards</h4>
              <p className="text-[10px] text-slate-400">Most dismissals by country</p>
            </div>
            <input
              type="text"
              placeholder="e.g. Uruguay…"
              value={localOutrights.mostRedCards || ''}
              onChange={(e) => setLocalOutrights((p) => ({ ...p, mostRedCards: e.target.value }))}
              disabled={isClosed}
              className="w-full max-w-[170px] text-center px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#14665F]"
            />
          </div>

          {/* Total Headed Goals */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border-2 border-indigo-500 flex items-center justify-center text-indigo-600 relative">
              <Award className="w-7 h-7" />
              <span className="absolute -top-1.5 -right-1 bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">Heads</span>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs">Total Headed Goals</h4>
              <p className="text-[10px] text-slate-400">Header goals across all matches</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => !isClosed && setLocalOutrights((p) => ({ ...p, totalHeadedGoals: Math.max(0, Number(p.totalHeadedGoals || 0) - 1) }))}
                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-full border border-slate-200 cursor-pointer">−</button>
              <span className="w-10 text-center text-sm font-mono font-black">{localOutrights.totalHeadedGoals || 0}</span>
              <button type="button" onClick={() => !isClosed && setLocalOutrights((p) => ({ ...p, totalHeadedGoals: Number(p.totalHeadedGoals || 0) + 1 }))}
                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-full border border-slate-200 cursor-pointer">+</button>
            </div>
          </div>
        </div>

        {!isClosed && (
          <div className="flex justify-center pt-2">
            <button onClick={saveOutrightsAction}
              className="flex items-center gap-1.5 px-6 py-2 bg-[#14665F] text-white hover:bg-[#072C23] rounded-full text-xs font-extrabold cursor-pointer transition-colors">
              <Save className="w-3.5 h-3.5" /> Save Special Predictions
            </button>
          </div>
        )}
      </div>

      {/* ── Match cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5">
        {visibleMatches.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border text-slate-400 font-bold">
            <HelpCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No upcoming matches right now.</p>
            <p className="text-xs font-medium text-slate-400 mt-1">Check back closer to tournament start or add matches in the Admin tab.</p>
          </div>
        ) : (
          visibleMatches.map((match, idx) => {
            const currentPred = predictions[match.id];
            const isEditing   = editingMatchId === match.id;
            const stats       = consensusMap[match.id] ?? { winA: 33, draw: 33, winB: 34 };
            const coins       = getMatchCoinsValue(match);

            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white border border-slate-200 shadow-sm hover:shadow-md rounded-3xl overflow-hidden transition-shadow"
              >
                {/* ── Row 1: Stage + Points ─────────────────────────────── */}
                <div className="bg-slate-50 px-5 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#14665F] uppercase tracking-wider">
                    {formatStage(match.stage)}
                  </span>
                  <div className="flex items-center gap-2">
                    {match.status === 'LIVE' && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        Live {match.minute ? `· ${match.minute}` : ''}
                      </span>
                    )}
                    <span className="bg-yellow-400/10 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded-md select-none">
                      {coins} 🪙
                    </span>
                  </div>
                </div>

                {/* ── Row 2: Date · Group ───────────────────────────────── */}
                <div className="px-5 pt-4 pb-0 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span>{match.date}</span>
                  {match.venue && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{match.venue}</span>
                    </>
                  )}
                </div>

                {/* ── Row 3: Teams + Score ──────────────────────────────── */}
                <div className="px-5 py-5">
                  <div className="flex items-center justify-between gap-4">

                    {/* Team A */}
                    <div className="flex-1 flex flex-col items-center text-center min-w-0">
                      <span className="text-5xl leading-none">{match.flagA}</span>
                      <span className="text-sm font-extrabold text-slate-800 mt-2 truncate w-full px-1">{match.teamA}</span>
                    </div>

                    {/* Score / editor */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {isEditing ? (
                        /* ── Editing: spinners inline ── */
                        <div className="flex items-center gap-3">
                          <ScoreSpinner value={localScoreA} onChange={setLocalScoreA} />
                          <span className="text-2xl font-black text-slate-300">:</span>
                          <ScoreSpinner value={localScoreB} onChange={setLocalScoreB} />
                        </div>
                      ) : currentPred ? (
                        /* ── Saved prediction score ── */
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-black font-mono text-[#14665F]">
                            {currentPred.predictedScoreA}
                          </span>
                          <span className="text-slate-300 font-black text-xl">:</span>
                          <span className="text-3xl font-black font-mono text-[#14665F]">
                            {currentPred.predictedScoreB}
                          </span>
                        </div>
                      ) : (
                        /* ── No prediction yet ── */
                        <span className="text-xs bg-slate-200 text-slate-500 font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                          VS
                        </span>
                      )}

                      {/* First goal badge (saved state only) */}
                      {!isEditing && currentPred?.firstGoalTime && (
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {currentPred.firstGoalTime}
                        </span>
                      )}
                    </div>

                    {/* Team B */}
                    <div className="flex-1 flex flex-col items-center text-center min-w-0">
                      <span className="text-5xl leading-none">{match.flagB}</span>
                      <span className="text-sm font-extrabold text-slate-800 mt-2 truncate w-full px-1">{match.teamB}</span>
                    </div>
                  </div>
                </div>

                {/* ── Row 4: First-goal time selector (editing only) ───── */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 overflow-hidden"
                    >
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4 space-y-2">
                        <span className="text-[10px] font-black text-[#14665F] uppercase tracking-wider flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-400" />
                          Time of First Goal
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {["1 - 15'", "16 - 30'", "31 - 45'", "46 - 60'", "61 - 75'", "76 - 90+'"].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setLocalFirstGoal(localFirstGoal === r ? '' : r)}
                              className={`py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                                localFirstGoal === r
                                  ? 'bg-[#14665F] text-white border-[#14665F]'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Row 5: Consensus Stats ────────────────────────────── */}
                <div className="px-5 pb-4 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Guesty Consensus Forecast Stats
                  </p>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-[#14665F] transition-all duration-500" style={{ width: `${stats.winA}%` }} />
                    <div className="bg-slate-300 transition-all duration-500" style={{ width: `${stats.draw}%` }} />
                    <div className="bg-[#072C23] transition-all duration-500" style={{ width: `${stats.winB}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{match.flagA} {stats.winA}%</span>
                    <span>Draw {stats.draw}%</span>
                    <span>{stats.winB}% {match.flagB}</span>
                  </div>
                </div>

                {/* ── Row 6: CTA ────────────────────────────────────────── */}
                <div className="px-5 pb-5">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingMatchId(null)}
                        className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveLocalPrediction(match.id, match.teamA, match.teamB)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#14665F] text-white hover:bg-[#072C23] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Forecast
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(match)}
                      disabled={isClosed}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                        isClosed
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : currentPred
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            : 'bg-[#14665F] text-white hover:bg-[#072C23] shadow-sm'
                      }`}
                    >
                      {currentPred ? (
                        <><Pencil className="w-3.5 h-3.5" /> Edit Score</>
                      ) : (
                        'Predict Score'
                      )}
                    </button>
                  )}
                </div>

              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
