export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string; // e.g., "Jun 12, 2026"
  time: string; // e.g., "18:00"
  timestamp: string; // ISO string or parsable date for locking predictions
  venue: string;
  city: string;
  status: MatchStatus;
  scoreA?: number | null; // actual final score if live or finished
  scoreB?: number | null; // actual final score if live or finished
  minute?: string; // only for live
  stage?: string; // e.g., "Group Stage", "Round of 32", etc.
}

export interface Prediction {
  matchId: string;
  predictedScoreA: number;
  predictedScoreB: number;
  lastUpdated: string;
  firstGoalTime?: string; // e.g. "1 - 15'", "16 - 30'", etc.
}

export interface Employee {
  id: string;
  fullName: string;
  department: string;
  site: string; // e.g. Tel Aviv, New York, Kyiv, Barcelona
  points: number;
  avatarUrl?: string;
  avatarColor: string;
  recentChangeType?: 'up' | 'down' | null;
  prevRank?: number;
  totalGames?: number;  // count of predictions submitted (server: predictionCount)
  totalWins?: number;   // exactCorrectCount + winnerCorrectCount
}

export interface DepartmentStats {
  department: string;
  averageScore: number;
  color: string;
  activePredictors: number;
}
