import { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Trophy, 
  Star, 
  Info,
  MapPin,
  Menu as MenuIcon, 
  X as CloseIcon, 
  RotateCcw,
  LogOut,
  Sliders,
  CheckCircle,
  HelpCircle,
  Award,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

// Types and Mock Data
import { Match, Prediction, Employee } from './types';
import { INITIAL_MATCHES, INITIAL_EMPLOYEES } from './data/mockData';

// Custom Components
import LoginScreen from './components/LoginScreen';
import Onboarding from './components/Onboarding';
import MatchPredictor from './components/MatchPredictor';
import Leaderboard from './components/Leaderboard';
import { CountdownClock } from './components/CountdownClock';
import AdminPanel from './components/AdminPanel';
import GuestyLogo from './components/GuestyLogo';

// Scoring calculate function
import { calculatePredictionPoints, getMatchCoinsValue } from './utils/scoring';

export default function App() {
  // Navigation tab states
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Predictions' | 'Leaderboard' | 'Rules' | 'Admin'>('Dashboard');
  
  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<{ fullName: string; email: string; department: string; site: string } | null>(null);

  // Welcome / Onboarding Modal state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Lockdown Clock state (passed from Countdown)
  const [isPredictionsClosed, setIsPredictionsClosed] = useState<boolean>(false);

  // Force Admin Lockdown Override
  const [forceGlobalLock, setForceGlobalLock] = useState<boolean>(false);

  // Match list State (initialized from LocalStorage or mockData)
  const [matches, setMatches] = useState<Match[]>([]);

  // Predictions Records state (MatchId -> Predicted Goals)
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});

  // Tournament wide outright predictions state
  const [outrights, setOutrights] = useState<{
    topScorer: string;
    mostRedCards: string;
    timeFirstGoal: string;
    totalHeadedGoals: number | '';
  }>({
    topScorer: '',
    mostRedCards: '',
    timeFirstGoal: '',
    totalHeadedGoals: '',
  });

  // Employees state for real-time rank updates
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Real-time live activity logs ticker
  const [activityLogs, setActivityLogs] = useState<{ id: string; text: string; time: string }[]>([
    { id: '1', text: 'Sarah Miller (Customer Success, Tel Aviv) just placed a prediction on Brazil vs Japan!', time: '1m ago' },
    { id: '2', text: 'Alexander Kovalenko (Engineering, Kyiv) boosted Mexico vs Germany with 2X Star!', time: '3m ago' },
    { id: '3', text: 'David Chen (Engineering, New York) gained +250 Coins for correct outcomes!', time: '5m ago' },
  ]);

  // Trigger global confetti burst
  const triggerCelebration = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#14665F', '#072C23', '#8CBEBE', '#FA877D']
    });
  };

  // 1. Initial State Loading from LocalStorage on mount
  useEffect(() => {
    // Current logged-in user
    const profileSaved = localStorage.getItem('guesty_user_profile');
    if (profileSaved) {
      setCurrentUser(JSON.parse(profileSaved));
    }

    // Onboarding status mapping
    const hasSeen = localStorage.getItem('guesty_onboard_completed_v2');
    if (hasSeen === 'true') {
      setShowOnboarding(false);
    } else if (profileSaved) {
      setShowOnboarding(true);
    }

    // Matches initialization
    const matchesSaved = localStorage.getItem('guesty_matches_v2');
    if (matchesSaved) {
      setMatches(JSON.parse(matchesSaved));
    } else {
      setMatches(INITIAL_MATCHES);
    }

    // Predictions initialization with Portugal-Ghana pre-seed
    const predictionsSaved = localStorage.getItem('guesty_predictions_v3');
    if (predictionsSaved) {
      setPredictions(JSON.parse(predictionsSaved));
    } else {
      const initialSeed = {
        'm-finished-1': {
          matchId: 'm-finished-1',
          predictedScoreA: 3,
          predictedScoreB: 0,
          lastUpdated: new Date().toISOString()
        }
      };
      setPredictions(initialSeed);
      localStorage.setItem('guesty_predictions_v3', JSON.stringify(initialSeed));
    }

    // Outrights initialization
    const outrightsSaved = localStorage.getItem('guesty_outrights_v3');
    if (outrightsSaved) {
      setOutrights(JSON.parse(outrightsSaved));
    }

    // Force Global prediction lock
    const forceLockSaved = localStorage.getItem('guesty_force_lock');
    if (forceLockSaved === 'true') {
      setForceGlobalLock(true);
    }
  }, []);

  // 2. State Persistent synchronization
  useEffect(() => {
    if (matches.length > 0) {
      localStorage.setItem('guesty_matches_v2', JSON.stringify(matches));
    }
  }, [matches]);

  useEffect(() => {
    localStorage.setItem('guesty_predictions_v3', JSON.stringify(predictions));
  }, [predictions]);

  useEffect(() => {
    localStorage.setItem('guesty_outrights_v3', JSON.stringify(outrights));
  }, [outrights]);

  // Auth handler
  const handleLogin = (profile: { fullName: string; email: string; department: string; site: string }) => {
    setCurrentUser(profile);
    localStorage.setItem('guesty_user_profile', JSON.stringify(profile));
    
    // Check if onboarding needs to be shown
    const hasSeen = localStorage.getItem('guesty_onboard_completed_v2');
    if (hasSeen !== 'true') {
      setShowOnboarding(true);
    }
    
    triggerCelebration();
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out from the prediction portal?')) {
      setCurrentUser(null);
      localStorage.removeItem('guesty_user_profile');
      localStorage.removeItem('guesty_onboard_completed_v2');
      setActiveTab('Dashboard');
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('guesty_onboard_completed_v2', 'true');
    setShowOnboarding(false);
    triggerCelebration();
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem('guesty_onboard_completed_v2');
    setShowOnboarding(true);
  };

  // User Actions to record a prediction
  const handleSavePrediction = (matchId: string, scoreA: number, scoreB: number, firstGoalTime?: string) => {
    const isLocked = isPredictionsClosed || forceGlobalLock;
    if (isLocked) return;
    
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        matchId,
        predictedScoreA: scoreA,
        predictedScoreB: scoreB,
        firstGoalTime: firstGoalTime || prev[matchId]?.firstGoalTime || '',
        lastUpdated: new Date().toISOString(),
      },
    }));
  };

  // Dynamic calculated correct guesses count for finished matches
  const correctGuessesCount = useMemo(() => {
    let count = 0;
    matches.forEach((match) => {
      if (match.status === 'FINISHED') {
        const pred = predictions[match.id];
        if (pred) {
          const scoreResult = calculatePredictionPoints(pred, match);
          if (scoreResult.points > 0) {
            count++;
          }
        }
      }
    });
    return count;
  }, [predictions, matches]);

  // Dynamic calculated score points for logged in user based on Finished Match Predictions
  const coinBalance = useMemo(() => {
    let earnedCoins = 0;
    matches.forEach((match) => {
      if (match.status === 'FINISHED') {
        const pred = predictions[match.id];
        
        const scoreResult = calculatePredictionPoints(pred, match);
        // User guesses correctly if score represents exact outcomes or correct outcome winners
        if (scoreResult.type === 'exact' || scoreResult.type === 'winner') {
          earnedCoins += getMatchCoinsValue(match);
        }
      }
    });

    return earnedCoins;
  }, [predictions, matches]);

  // Synchronize and initialize employee list state
  useEffect(() => {
    if (!currentUser) return;

    setEmployees((prev) => {
      const userObj = {
        id: 'emp-logged',
        fullName: currentUser.fullName,
        department: currentUser.department,
        site: currentUser.site,
        points: coinBalance,
        avatarColor: 'from-[#14665F] to-[#072C23]',
      };

      if (prev.length > 0) {
        // Find if user already exists in list and update, otherwise insert
        const userExists = prev.some(e => e.id === 'emp-logged');
        if (userExists) {
          return prev.map(e => e.id === 'emp-logged' ? userObj : e).sort((a, b) => b.points - a.points);
        } else {
          return [userObj, ...prev].sort((a, b) => b.points - a.points);
        }
      } else {
        // Initial setup
        return [...INITIAL_EMPLOYEES, userObj].sort((a, b) => b.points - a.points);
      }
    });
  }, [currentUser, coinBalance]);

  // Real-time updates simulation of colleagues' coin standings and live activity logs
  useEffect(() => {
    if (employees.length === 0) return;

    const interval = setInterval(() => {
      const targetList = employees.filter((e) => e.id !== 'emp-logged');
      if (targetList.length === 0) return;

      const randomEmp = targetList[Math.floor(Math.random() * targetList.length)];
      const coinsDiff = Math.random() > 0.4 ? 250 : 350;

      const actions = [
        `predicted the exact score for Spain vs England`,
        `calculated correct goals difference for USA matchup`,
        `is leading the standings after final match stats`,
        `placed prediction stakes for tomorrow's tournament match`,
      ];
      const selectedAction = actions[Math.floor(Math.random() * actions.length)];

      setEmployees((prev) => {
        const updated = prev.map((e) => {
          if (e.id === randomEmp.id) {
            return {
              ...e,
              points: e.points + coinsDiff,
            };
          }
          return e;
        });
        return [...updated].sort((a, b) => b.points - a.points);
      });

      // Add to activity logs
      const newLog = {
        id: String(Date.now()),
        text: `${randomEmp.fullName} (${randomEmp.department}, ${randomEmp.site}) ${selectedAction} (+${coinsDiff} Coins)`,
        time: 'Just now',
      };
      setActivityLogs((prev) => [newLog, ...prev.slice(0, 4)]);
    }, 10000);

    return () => clearInterval(interval);
  }, [employees]);

  // Dashboard Stats cards calculations
  const statsList = useMemo(() => {
    const activeBetsCount = Object.keys(predictions).length;
    const outrightsCount = [outrights.topScorer, outrights.mostRedCards, outrights.totalHeadedGoals]
      .filter(val => val !== undefined && val !== null && val !== '').length;

    return [
      { label: 'My Placed Bets', value: `${activeBetsCount} Match${activeBetsCount === 1 ? '' : 'es'}`, sub: `Group Stage forecasts`, icon: CalendarDays, color: '#14665F' },
      { label: 'My Saved Outrights', value: `${outrightsCount} Option${outrightsCount === 1 ? '' : 's'}`, sub: `Tournament-wide specials`, icon: Trophy, color: '#FA877D' },
      { label: 'My Correct Guesses', value: `${correctGuessesCount} Match${correctGuessesCount === 1 ? '' : 'es'}`, sub: `Successful score/winner picks`, icon: CheckCircle, color: '#072C23' },
    ];
  }, [predictions, outrights, correctGuessesCount]);

  // Admin Actions
  const handleAddMatch = (newMatch: Match) => {
    setMatches((prev) => [newMatch, ...prev]);
  };

  const handleUpdateMatch = (updatedMatch: Match) => {
    setMatches((prev) => prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m)));
  };

  const handleToggleForceGlobalLock = () => {
    setForceGlobalLock((prev) => {
      const next = !prev;
      localStorage.setItem('guesty_force_lock', String(next));
      return next;
    });
  };

  // Check if either natural deadline or admin override locks predictions
  const isCurrentlyLocked = isPredictionsClosed || forceGlobalLock;

  // Render Login screen if not authenticated
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#F7F5F2] font-sans text-slate-900 overflow-hidden relative">
      
      {/* Onboarding Welcome / Betting Rules Modal */}
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      {/* Slide-out Sidebar for screens (collapsible / toggleable) */}
      <aside 
        className={`fixed md:relative z-40 h-full w-64 bg-[#072C23] text-white transition-transform duration-300 md:translate-x-0 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-nature/20">
          <div className="flex flex-col gap-1">
            <GuestyLogo className="h-7 text-[#EEFAD0]" color="#EEFAD0" />
            <span className="text-[10px] font-bold text-teal mt-0.5 uppercase tracking-wider block">World Cup Portal</span>
          </div>
          {/* Close Sidebar button when in Mobile drawer mode */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 bg-white/10 rounded-lg hover:bg-white/20 select-none cursor-pointer"
          >
            <CloseIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sidebar Nav buttons */}
        <nav className="flex-1 py-6 px-3 space-y-2">
          {[
            { id: 'Dashboard', name: 'Dashboard Hub', icon: LayoutDashboard },
            { id: 'Predictions', name: 'Place Predictions', icon: CalendarDays },
            { id: 'Leaderboard', name: 'Live Leaderboard', icon: Trophy },
            { id: 'Rules', name: 'How to Play', icon: Info },
            { id: 'Admin', name: 'Admin Control Center', icon: Sliders },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setIsSidebarOpen(false); // auto-close drawer on mobile selects
                }}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all select-none cursor-pointer ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-xs ring-1 ring-white/20 font-bold' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-sm">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Dynamic Reset Info Panel */}
        <div className="p-4 border-t border-white/10 space-y-2 bg-black/20">
          <div className="flex items-center justify-between gap-1 px-3 py-2 bg-slate-800/60 rounded-xl">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-teal" />
              <span className="text-xs font-black text-slate-300">
                {correctGuessesCount} Wins
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 p-1 rounded-md cursor-pointer transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <button 
            onClick={handleResetOnboarding}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#14665F]/40 text-slate-350 text-[10px] font-bold rounded-xl border border-white/15 hover:bg-[#14665F] hover:text-white transition-all select-none cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart Onboarding Popups
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Mobile Header bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors select-none cursor-pointer"
              aria-label="Open sidebar drawer"
              id="sidebar-toggle-main"
            >
              <MenuIcon className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-sm md:text-lg font-black text-[#14665F] flex items-center gap-2">
                <span>{activeTab === 'Dashboard' ? 'Betting Hub' : activeTab === 'Admin' ? 'Admin Mode' : activeTab}</span>
                <span className="hidden sm:inline text-slate-300">/</span>
                <span className="hidden sm:inline text-[9px] bg-slate-100 px-2.5 py-1 rounded text-slate-500 uppercase tracking-wider font-extrabold font-mono">
                  {currentUser.fullName} • {currentUser.site}
                </span>
              </h1>
            </div>
          </div>

          {/* User Score Stats bar */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/25 select-none text-amber-700">
              <Coins className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />
              <span className="font-mono font-black text-xs">
                {coinBalance.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 select-none">
              <div className="hidden xs:block text-right">
                <p className="text-xs font-black text-slate-900 leading-none">{currentUser.fullName}</p>
                <span className="text-[9px] font-extrabold text-slate-400 tracking-wider flex items-center gap-0.5 justify-end mt-0.5 uppercase">
                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" /> PRO
                </span>
              </div>
              <div className="w-9 h-9 bg-gradient-to-tr from-[#14665F] to-[#072C23] rounded-full flex items-center justify-center text-white font-black text-xs border border-white shrink-0 shadow-sm">
                {currentUser.fullName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Scroller */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Lockdown Clock countdown counts down to June 10th */}
          <CountdownClock 
            onDeadlineReached={setIsPredictionsClosed} 
            onPredictClick={() => setActiveTab('Predictions')}
          />

          {/* ACTIVE TAB VIEWS CONTAINER */}
          <div className="min-h-[60vh] pb-10">
            
            {/* View 1: DASHBOARD HUB */}
            {activeTab === 'Dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Stats cards */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {statsList.map((stat, i) => (
                    <div 
                      key={stat.label} 
                      className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="p-3 rounded-2xl shrink-0" style={{ backgroundColor: `${stat.color}15` }}>
                        <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <h4 className="text-xl font-black text-slate-900 mt-0.5 tracking-tight">{stat.value}</h4>
                        <p className="text-slate-400 text-[10px] font-semibold">{stat.sub}</p>
                      </div>
                    </div>
                  ))}
                </section>

                {/* Live activity feed banner ticker */}
                <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 border border-slate-800 shadow-sm overflow-hidden relative select-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#14665F]/10 blur-2xl rounded-full" />
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14665F] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#14665F]"></span>
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#14665F]">Live Sports feed ticker</p>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {activityLogs.map((log) => (
                        <motion.div
                          layout
                          key={log.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="text-xs transition-all flex items-center justify-between font-mono bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5"
                        >
                          <span className="truncate pr-4 text-white font-medium">{log.text}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-bold">{log.time}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Dashboard Grid Container */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Initial Matches */}
                  <div className="lg:col-span-7">
                    <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between border-b pb-4 mb-5">
                          <div>
                            <h3 className="text-lg font-black text-[#14665F]">Initial Matches</h3>
                            <p className="text-slate-500 text-xs font-medium">Predictions requested for these opening fixtures</p>
                          </div>
                          <button 
                            onClick={() => setActiveTab('Predictions')}
                            className="text-xs font-extrabold text-[#14665F] hover:underline"
                          >
                            Show All Matches →
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3.5">
                          {matches.slice(0, 4).map((match) => {
                            const selection = predictions[match.id];
                            const isMatchLocked = isCurrentlyLocked || match.status === 'LIVE' || match.status === 'FINISHED';
                            return (
                              <div 
                                key={match.id} 
                                className="p-3.5 sm:p-4 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 sm:gap-4 hover:border-slate-200 transition-all"
                              >
                                <div className="truncate flex-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                                    {match.date} • {match.venue}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 font-bold text-xs sm:text-sm text-slate-800">
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span>{match.flagA}</span>
                                      <span>{match.teamA}</span>
                                    </span>
                                    {match.status === 'FINISHED' || match.status === 'LIVE' ? (
                                      <span className="bg-slate-200 px-1.5 py-0.5 text-xs text-slate-850 rounded font-mono font-black shrink-0 inline-flex items-center gap-0.5 select-none whitespace-nowrap">
                                        <span>{match.scoreA}</span>
                                        <span className="text-slate-400 font-extrabold">:</span>
                                        <span>{match.scoreB}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-350 font-black text-xs shrink-0">VS</span>
                                    )}
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span>{match.flagB}</span>
                                      <span>{match.teamB}</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  {selection ? (
                                    <div className="text-right flex flex-col items-end gap-1 select-none">
                                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase px-2 py-1 rounded border border-emerald-100 font-mono">
                                        {selection.predictedScoreA} - {selection.predictedScoreB}
                                      </span>
                                      {isMatchLocked && (
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                          Locked
                                        </span>
                                      )}
                                    </div>
                                  ) : match.status === 'LIVE' || match.status === 'FINISHED' ? (
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wider select-none shrink-0">
                                      Closed
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => setActiveTab('Predictions')}
                                      disabled={isMatchLocked}
                                      className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase transition-colors select-none cursor-pointer shrink-0 ${
                                        isMatchLocked
                                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                          : 'bg-[#14665F] text-white hover:bg-[#072C23]'
                                      }`}
                                    >
                                      {isMatchLocked ? 'Locked' : 'Predict'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Highlevel Leaderboard */}
                  <div className="lg:col-span-5">
                    <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between border-b pb-4 mb-5">
                          <div>
                            <h3 className="text-lg font-black text-[#14665F]">Top Predictors</h3>
                            <p className="text-slate-500 text-xs font-medium">Current leaderboard standings</p>
                          </div>
                          <button 
                            onClick={() => setActiveTab('Leaderboard')}
                            className="text-xs font-extrabold text-[#14665F] hover:underline cursor-pointer"
                          >
                            All Standings &rarr;
                          </button>
                        </div>

                        <div className="space-y-3">
                          {employees.slice(0, 4).map((emp, idx) => {
                            const isUser = emp.id === 'emp-logged';
                            const initials = emp.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                            const rank = idx + 1;
                            
                            // Approximate matches guessed correctly based on leaderboard relative standings
                            const correctGuesses = emp.points > 1200 ? 4 : emp.points > 1050 ? 3 : 1;

                            return (
                              <div 
                                key={emp.id}
                                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                  isUser 
                                    ? 'bg-[#14665F]/5 border-[#14665F]/30 shadow-xs' 
                                    : 'bg-slate-50 border-slate-100/75 hover:bg-slate-100/50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <div className="w-5 h-5 flex items-center justify-center font-bold text-xs select-none">
                                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                                  </div>
                                  
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-tr ${emp.avatarColor || 'from-[#14665F] to-teal'} text-white font-black text-[10px] shrink-0`}>
                                    {initials}
                                  </div>

                                  <div className="truncate">
                                    <h4 className="font-extrabold text-slate-850 text-xs truncate flex items-center gap-1 leading-tight">
                                      {emp.fullName}
                                      {isUser && <span className="text-[8px] bg-[#14665F] text-white px-1 py-0.2 rounded font-black scale-95 uppercase leading-none">YOU</span>}
                                    </h4>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                      {emp.department} • {emp.site}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-mono font-black text-xs text-[#14665F] flex items-center justify-end gap-0.5 select-none">
                                    {emp.points.toLocaleString()}
                                    <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
                                  </span>
                                  <div className="text-[8px] font-bold text-slate-450 mt-0.5">
                                    {correctGuesses} Correct
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-4">
                        <button
                           onClick={() => setActiveTab('Leaderboard')}
                          className="w-full py-2.5 bg-[#14665F] hover:bg-[#072C23] transition-colors text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                           <Trophy className="w-4 h-4 text-emerald-400" />
                          See All Standings
                        </button>
                      </div>
                    </section>
                  </div>

                </div>
              </div>
            )}

            {/* View 2: PREDICTION INPUT HUB */}
            {activeTab === 'Predictions' && (
              <MatchPredictor 
                matches={matches}
                predictions={predictions}
                onSavePrediction={handleSavePrediction}
                isClosed={isCurrentlyLocked}
                outrights={outrights}
                onSaveOutrights={setOutrights}
              />
            )}

            {/* View 3: LEADERBOARD BOARD */}
            {activeTab === 'Leaderboard' && (
              <Leaderboard 
                employees={employees} 
                userId="emp-logged" 
                activityLogs={activityLogs}
              />
            )}

            {/* View 4: RULES EXPLANATION */}
            {activeTab === 'Rules' && (
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-3 duration-300">
                <div className="border-b pb-4">
                  <span className="text-xs font-bold text-[#14665F] bg-[#14665F]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Rules and Regulations
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 mt-2">How Guesty World Cup Game Works</h3>
                  <p className="text-slate-500 text-sm font-medium mt-1">Review the betting multipliers and lock schedule guidelines.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="w-10 h-10 bg-[#14665F]/15 rounded-lg flex items-center justify-center text-[#14665F] font-bold">
                      1
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base">Predict Exact Goals</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Instead of predicting just wins or draws, you are betting on the exact scores (e.g., 3-1, 2-2). Correct exact forecasts yield maximum points (100).
                    </p>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="w-10 h-10 bg-[#FA877D]/15 rounded-lg flex items-center justify-center text-[#FA877D] font-bold">
                      2
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base">First Goal Range</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      For any matches you predict, you also submit the minute range for the First Goal. This is game-specific rather than World Cup-wide, keeping predictions precise.
                    </p>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="w-10 h-10 bg-[#072C23]/15 rounded-lg flex items-center justify-center text-[#072C23] font-bold">
                      3
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base">June 10th Hard Lock</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Once the countdown clock to June 10th reaches 0, the sports prediction panel shuts down automatically. Be absolutely certain to click 'Save' on all matches prior to lockout.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border rounded-2xl space-y-2.5">
                  <h4 className="font-extrabold text-slate-800 text-sm">Points Award System Tiers:</h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#14665F] shrink-0" />
                      <strong>Exact Score Predicted Match Winner:</strong> +100 points
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#FA877D] shrink-0" />
                      <strong>Correct Outcome (Draw or Winner) but incorrect score tally:</strong> +40 points
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#072C23] shrink-0" />
                      <strong>Wrong forecast outcome:</strong> 0 points
                    </li>
                  </ul>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t text-left">
                    ★ First goal range predictions award bonus points when matching the actual live goal times!
                  </p>
                </div>

                <div className="p-4 bg-[#212330] text-slate-200 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-400">FAQ Standings</p>
                  <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">
                    Yes! Your predictions calculate dynamically on the board. The live background simulator demonstrates the active sports bets placed by your global team members in Tel Aviv, Barcelona, Kyiv, and New York. Keep refreshing or check your metrics to defend your ranking!
                  </p>
                </div>
              </div>
            )}

            {/* View 5: ADMIN OPTION PANEL PANEL */}
            {activeTab === 'Admin' && (
              <AdminPanel 
                matches={matches}
                onAddMatch={handleAddMatch}
                onUpdateMatch={handleUpdateMatch}
                onToggleForceGlobalLock={handleToggleForceGlobalLock}
                globalLockOverride={forceGlobalLock}
                employees={employees}
                onTriggerCelebrate={triggerCelebration}
              />
            )}

          </div>

        </div>

        {/* Footer info bar */}
        <footer className="h-10 bg-slate-50 border-t border-slate-200 px-4 md:px-6 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3CAC3B]" /> 
              Sim Feed: Active
            </span>
            <span className="hidden xs:inline">Tournament Year: FIFA 2026</span>
          </div>
          <p className="truncate">© 2026 Guesty Inc. • Booking World Cup</p>
        </footer>
      </main>
      
    </div>
  );
}
