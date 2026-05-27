import { Prediction, Match } from '../types';

/**
 * Returns coin reward based on match tournament stage
 */
export function getMatchCoinsValue(match: Match): number {
  const stage = match.stage || 'Group Stage';
  if (stage === 'Group Stage') return 250;
  if (stage === 'Round of 32') return 350;
  if (stage === 'Round of 16') return 450;
  if (stage === 'Quarterfinals') return 500;
  if (stage === 'Semifinals') return 1000;
  if (stage === 'Final Match') return 2000;
  return 250; // Fallback default
}

/**
 * Scoring Rules:
 * - Exact score prediction = 100 points
 * - Correct winner prediction or correct draw = 40 points
 * - Incorrect prediction = 0 points
 * - If 2X Booster is active for the match, double the points!
 */
export function calculatePredictionPoints(
  pred: Prediction | undefined,
  match: Match
): { points: number; type: 'exact' | 'winner' | 'miss' | 'unplayed' } {
  if (!pred) {
    return { points: 0, type: 'unplayed' };
  }

  if (
    match.scoreA === undefined || 
    match.scoreA === null || 
    match.scoreB === undefined || 
    match.scoreB === null ||
    match.status !== 'FINISHED'
  ) {
    return { points: 0, type: 'unplayed' }; // Not finished or no scores yet
  }

  const predA = pred.predictedScoreA;
  const predB = pred.predictedScoreB;
  const scoreA = match.scoreA;
  const scoreB = match.scoreB;

  // Exact Match Check
  if (predA === scoreA && predB === scoreB) {
    return { points: 100, type: 'exact' };
  }

  // Correct Winner Check
  const predDiff = predA - predB;
  const actualDiff = scoreA - scoreB;

  const predWinner = predDiff > 0 ? 'A' : predDiff < 0 ? 'B' : 'Draw';
  const actualWinner = actualDiff > 0 ? 'A' : actualDiff < 0 ? 'B' : 'Draw';

  if (predWinner === actualWinner) {
    return { points: 40, type: 'winner' };
  }

  return { points: 0, type: 'miss' };
}
