import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee } from '../types';
import { 
  Trophy, Building, MapPin, Zap, Flame, Award, 
  Search, Star, Coins
} from 'lucide-react';

interface ActivityLog {
  id: string;
  text: string;
  time: string;
}

interface LeaderboardProps {
  employees: Employee[];
  userId: string;
  activityLogs: ActivityLog[];
}

export default function Leaderboard({ employees, userId, activityLogs }: LeaderboardProps) {
  const [filteredDept, setFilteredDept] = useState<string>('All');
  const [filteredSite, setFilteredSite] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract filters dynamically from the employees list
  const departments = ['All', ...Array.from(new Set(employees.map(e => e.department)))];
  const sites = ['All', ...Array.from(new Set(employees.map(e => e.site)))];

  // Filter & Search
  const visibleEmployees = employees.filter((emp) => {
    const matchesDept = filteredDept === 'All' || emp.department === filteredDept;
    const matchesSite = filteredSite === 'All' || emp.site === filteredSite;
    const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.site.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSite && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Live activity feed banner (TICKER FIRST) */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 border border-slate-800 shadow-sm overflow-hidden relative">
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
                className="text-xs transition-all flex items-center justify-between font-mono bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 animate-in slide-in-from-top-1 duration-200"
              >
                <span className="truncate pr-4 text-white font-medium">{log.text}</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-bold">{log.time}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. Search & Filters Controls (BELOW TICKER) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div>
            <span className="text-xs font-bold text-[#14665F] bg-[#14665F]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Real-time Global Rankings
            </span>
            <h3 className="text-xl font-extrabold text-[#14665F] mt-2">Employee Leaderboard</h3>
            <p className="text-slate-500 text-xs font-medium">
              Monitor predictions and achievements of your colleagues grouped by department and site location.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#14665F] bg-[#14665F]/10 px-3 py-1.5 rounded-lg select-none">
            <Zap className="w-4 h-4 text-[#14665F] fill-[#14665F] animate-pulse" />
            Live Ticker Active
          </div>
        </div>

        {/* Input & Filters Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#14665F] focus:bg-white"
            />
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <Building className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <select
              value={filteredDept}
              onChange={(e) => setFilteredDept(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full cursor-pointer"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <select
              value={filteredSite}
              onChange={(e) => setFilteredSite(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full cursor-pointer"
            >
              {sites.map(site => (
                <option key={site} value={site}>{site === 'All' ? 'All Global Sites' : site}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Leaderboard Grid/Table */}
      <div className="bg-white rounded-3xl border border-[#001529]/10 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-5">Employee & Profile</div>
          <div className="col-span-3">Department</div>
          <div className="col-span-2">Site Link</div>
          <div className="col-span-1 text-right">Coins Balance</div>
        </div>

        <div className="divide-y divide-slate-100">
          <AnimatePresence initial={false}>
            {visibleEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold text-sm">
                No employees found matching the filters.
              </div>
            ) : (
              visibleEmployees.map((emp) => {
                const isUser = emp.id === 'emp-logged' || emp.id === userId;
                const initials = emp.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                const globalRank = employees.findIndex(e => e.id === emp.id) + 1;

                // Deterministic accuracy stats
                const correctExacts = emp.points > 1200 ? 4 : emp.points > 800 ? 3 : 1;
                const correctWinners = emp.points > 1200 ? 5 : emp.points > 800 ? 4 : 2;

                return (
                  <motion.div
                    layout
                    key={emp.id}
                    className={`flex md:grid md:grid-cols-12 gap-3 md:gap-4 items-center justify-between md:justify-start px-4 py-3 transition-all duration-300 ${
                      isUser
                        ? 'bg-[#14665F]/5 border-l-4 border-l-[#14665F]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Rank column */}
                    <div className="md:col-span-1 flex items-center justify-center shrink-0 w-8 md:w-auto">
                      {globalRank === 1 ? (
                        <div className="w-7 h-7 rounded-xl bg-amber-400 flex items-center justify-center text-white text-sm shadow-sm font-black border border-amber-300">
                          🥇
                        </div>
                      ) : globalRank === 2 ? (
                        <div className="w-7 h-7 rounded-xl bg-slate-300 flex items-center justify-center text-white text-sm shadow-sm font-black border border-slate-200">
                          🥈
                        </div>
                      ) : globalRank === 3 ? (
                        <div className="w-7 h-7 rounded-xl bg-amber-600 flex items-center justify-center text-white text-sm shadow-sm font-black border border-amber-500">
                          🥉
                        </div>
                      ) : (
                        <span className="font-mono text-slate-500 font-black text-sm pl-0 md:pl-2">{globalRank}</span>
                      )}
                    </div>

                    {/* Avatar and name */}
                    <div className="md:col-span-5 flex items-center gap-2.5 truncate flex-1 min-w-0 md:flex-initial">
                      <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center bg-gradient-to-tr ${emp.avatarColor || 'from-slate-500 to-slate-700'} text-white font-black text-[10px] md:text-xs shadow-xs shrink-0`}>
                        {initials}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <span className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs md:text-sm">
                          <span className="truncate">{emp.fullName}</span>
                          {isUser && (
                            <span className="bg-[#14665F] text-white text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-xs">
                              You
                            </span>
                          )}
                        </span>
                        
                        {/* Mobile Department / Site display */}
                        <div className="flex md:hidden items-center gap-1.5 mt-0.5 text-[9px] font-bold text-slate-400">
                          <span className="bg-slate-100 px-1 py-0.2 rounded text-[8px] uppercase tracking-wider text-[#14665F] truncate max-w-[80px]">
                            {emp.department}
                          </span>
                          <span>•</span>
                          <span className="bg-slate-100 px-1 py-0.2 rounded text-[8px] uppercase tracking-wider flex items-center gap-0.5 text-slate-500 truncate max-w-[80px]">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" /> {emp.site}
                          </span>
                        </div>
                        
                        {/* Extra predictions performance badge */}
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-0.5">
                          Accuracy: <span className="text-emerald-600">{correctExacts} Exact</span> • <span className="text-[#14665F]">{correctWinners} Outcome</span>
                        </p>
                      </div>
                    </div>

                    {/* Department (Desktop) */}
                    <div className="hidden md:block md:col-span-3 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <span className={isUser ? "text-[#14665F] font-black underline decoration-2 underline-offset-4" : "text-slate-600"}>
                        {emp.department}
                      </span>
                    </div>

                    {/* Site Location (Desktop) */}
                    <div className="hidden md:block md:col-span-2 text-slate-500 font-bold text-xs flex items-center gap-1 uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {emp.site}
                    </div>

                    {/* Coins Balance Total */}
                    <div className="md:col-span-1 text-right shrink-0">
                      <span className="font-mono font-black text-xs md:text-sm text-[#14665F] flex items-center justify-end gap-0.5 md:gap-1 select-none">
                        {emp.points.toLocaleString()}
                        <Coins className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 fill-amber-500/10 shrink-0" />
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
