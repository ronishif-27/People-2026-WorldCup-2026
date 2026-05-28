import { useState, FormEvent } from 'react';
import { Match, Employee } from '../types';
import { 
  Plus, Edit, Eye, Save, Trash, FileSpreadsheet, Lock, Unlock, 
  Settings, RefreshCw, Trophy, Bell, Check, MapPin, Building 
} from 'lucide-react';
import { motion } from 'motion/react';

interface AdminPanelProps {
  matches: Match[];
  onAddMatch: (match: Match) => void;
  onUpdateMatch: (updatedMatch: Match) => void;
  onToggleForceGlobalLock: () => void;
  globalLockOverride: boolean;
  employees: Employee[];
  onTriggerCelebrate: () => void;
}

export default function AdminPanel({
  matches,
  onAddMatch,
  onUpdateMatch,
  onToggleForceGlobalLock,
  globalLockOverride,
  employees,
  onTriggerCelebrate,
}: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'add' | 'export'>('matches');
  
  // State for Add Match Form
  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newFlagA, setNewFlagA] = useState('🏳️');
  const [newFlagB, setNewFlagB] = useState('🏳️');
  const [newDate, setNewDate] = useState('Jun 18, 2026');
  const [newTime, setNewTime] = useState('19:00');
  const [newVenue, setNewVenue] = useState('SoFi Stadium');
  const [newCity, setNewCity] = useState('Los Angeles, CA');
  const [newStage, setNewStage] = useState<'UPCOMING' | 'LIVE' | 'FINISHED'>('UPCOMING');
  const [newIsGroupStage, setNewIsGroupStage] = useState(true);

  // Editing match state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScoreA, setEditScoreA] = useState<number>(0);
  const [editScoreB, setEditScoreB] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'UPCOMING' | 'LIVE' | 'FINISHED'>('UPCOMING');
  const [editMinute, setEditMinute] = useState<string>('');
  
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  const displaySuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    onTriggerCelebrate();
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  const handleCreateMatch = (e: FormEvent) => {
    e.preventDefault();
    if (!newTeamA || !newTeamB) return;

    const newCreated: Match = {
      id: `m-custom-${Date.now()}`,
      teamA: newTeamA,
      teamB: newTeamB,
      flagA: newFlagA || '🏳️',
      flagB: newFlagB || '🏳️',
      date: newDate,
      time: newTime,
      timestamp: new Date(`2026-06-18T${newTime}:00Z`).toISOString(),
      venue: newVenue,
      city: newCity,
      status: newStage,
      scoreA: newStage !== 'UPCOMING' ? 0 : undefined,
      scoreB: newStage !== 'UPCOMING' ? 0 : undefined,
    };

    onAddMatch(newCreated);
    displaySuccess(`Successfully added match: ${newTeamA} vs ${newTeamB}!`);
    
    // Reset form
    setNewTeamA('');
    setNewTeamB('');
    setActiveSubTab('matches');
  };

  const startEditMatch = (m: Match) => {
    setEditingMatchId(m.id);
    setEditScoreA(m.scoreA ?? 0);
    setEditScoreB(m.scoreB ?? 0);
    setEditStatus(m.status);
    setEditMinute(m.minute ?? '');
  };

  const saveEditedMatch = (m: Match) => {
    const updated: Match = {
      ...m,
      status: editStatus,
      scoreA: editStatus === 'UPCOMING' ? undefined : editScoreA,
      scoreB: editStatus === 'UPCOMING' ? undefined : editScoreB,
      minute: editStatus === 'LIVE' ? editMinute : undefined,
    };
    onUpdateMatch(updated);
    setEditingMatchId(null);
    displaySuccess(`Match stats updated for ${m.teamA} vs ${m.teamB}!`);
  };

  // CSV Excel Exporter
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Rank,Full Name,Department,Site,Total Points\n';
    
    employees.forEach((emp, index) => {
      const row = `${index + 1},"${emp.fullName.replace(/"/g, '""')}","${emp.department}","${emp.site}",${emp.points}`;
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Guesty_WorldCup_Leaderboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    displaySuccess('CSV file successfully bundled and downloaded!');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <span className="text-xs font-bold text-[#E61D25] bg-[#E61D25]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Guesty Administrator Options
          </span>
          <h3 className="text-xl font-extrabold text-slate-800 mt-2">FIFA Group Stage Admin Control Room</h3>
          <p className="text-slate-500 text-xs font-medium">Add matches, input scores, trigger manual locks or print the CSV export.</p>
        </div>

        {/* Global lock buttons */}
        <button
          onClick={onToggleForceGlobalLock}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
            globalLockOverride
              ? 'bg-[#E61D25] text-white border-[#E61D25] hover:bg-red-700'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {globalLockOverride ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {globalLockOverride ? 'Predictions are Force-Locked' : 'Force-Lock Predictions'}
        </button>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2.5 text-xs font-bold animate-bounce shadow-xs">
          <Check className="w-4 h-4 stroke-[3]" />
          {actionSuccessMessage}
        </div>
      )}

      {/* Tabs list inside administrator configurations */}
      <div className="flex border-b text-xs font-bold uppercase tracking-widest text-slate-400 gap-2">
        <button
          onClick={() => setActiveSubTab('matches')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'matches' ? 'border-[#2A398D] text-[#2A398D]' : 'border-transparent'
          }`}
        >
          Scoreboard Manager ({matches.length})
        </button>
        <button
          onClick={() => setActiveSubTab('add')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'add' ? 'border-[#2A398D] text-[#2A398D]' : 'border-transparent'
          }`}
        >
          + Add Custom Match Card
        </button>
        <button
          onClick={() => setActiveSubTab('export')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'export' ? 'border-[#2A398D] text-[#2A398D]' : 'border-transparent'
          }`}
        >
          Statistics & Export
        </button>
      </div>

      {/* Sub-tab 1: MATCH LISTING & SPEED INJECTOR */}
      {activeSubTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mt-2">
            <span>TOURNAMENT MATCHUPS CONFIGURATION</span>
            <span className="text-emerald-500">Real-time DB Connection</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {matches.map((match) => {
              const isEditing = editingMatchId === match.id;
              return (
                <div key={match.id} className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 w-full">
                    {/* Flags */}
                    <div className="text-3xl filter shrink-0 flex items-center">
                      <span>{match.flagA}</span>
                      <span className="text-xs text-slate-300 mx-1">vs</span>
                      <span>{match.flagB}</span>
                    </div>

                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{match.teamA} vs {match.teamB}</span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          match.status === 'FINISHED' 
                            ? 'bg-slate-200 text-slate-600'
                            : match.status === 'LIVE'
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-emerald-500 text-white'
                        }`}>
                          {match.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {match.date} • {match.venue} ({match.city})
                      </p>
                    </div>
                  </div>

                  {/* Input controllers */}
                  {!isEditing ? (
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                      {match.status !== 'UPCOMING' && (
                        <div className="font-mono text-xs font-black bg-slate-200/85 px-3 py-1.5 rounded-xl text-slate-800">
                          {match.scoreA} - {match.scoreB} {match.minute ? `(${match.minute})` : ''}
                        </div>
                      )}
                      
                      <button
                        onClick={() => startEditMatch(match)}
                        className="p-2 border border-slate-200 hover:border-[#2A398D] text-slate-600 hover:text-[#2A398D] rounded-xl transition-all cursor-pointer bg-white shadow-xs"
                        aria-label="Edit match stats"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl w-full md:w-auto">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-xs font-extrabold pr-1 text-slate-400">Score:</span>
                        <input
                          type="number"
                          value={editScoreA}
                          onChange={(e) => setEditScoreA(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center py-1 border border-slate-200 rounded font-bold text-xs"
                        />
                        <span className="text-slate-400 font-bold">-</span>
                        <input
                          type="number"
                          value={editScoreB}
                          onChange={(e) => setEditScoreB(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center py-1 border border-slate-200 rounded font-bold text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs font-extrabold text-slate-400">Status:</span>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as any)}
                          className="text-xs font-bold border rounded p-1 bg-white cursor-pointer"
                        >
                          <option value="UPCOMING">UPCOMING</option>
                          <option value="LIVE">LIVE</option>
                          <option value="FINISHED">FINISHED</option>
                        </select>
                      </div>

                      {editStatus === 'LIVE' && (
                        <input
                          type="text"
                          placeholder="e.g. 84'"
                          value={editMinute}
                          onChange={(e) => setEditMinute(e.target.value)}
                          className="w-14 py-1 border rounded text-center text-xs font-mono font-bold"
                        />
                      )}

                      <button
                        onClick={() => saveEditedMatch(match)}
                        className="px-3 py-1 bg-[#3CAC3B] text-white text-xs font-extrabold uppercase rounded hover:bg-emerald-600 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>

                      <button
                        onClick={() => setEditingMatchId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 2: ADD A NEW MATCH */}
      {activeSubTab === 'add' && (
        <form onSubmit={handleCreateMatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team A Name</label>
              <input
                type="text"
                placeholder="e.g. Netherlands"
                value={newTeamA}
                onChange={(e) => setNewTeamA(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-bold text-xs text-slate-800"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team B Name</label>
              <input
                type="text"
                placeholder="e.g. Senegal"
                value={newTeamB}
                onChange={(e) => setNewTeamB(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-bold text-xs text-slate-800"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Flag Emoji A</label>
              <input
                type="text"
                placeholder="🇳🇱"
                value={newFlagA}
                onChange={(e) => setNewFlagA(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-bold text-xs text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Flag Emoji B</label>
              <input
                type="text"
                placeholder="🇸🇳"
                value={newFlagB}
                onChange={(e) => setNewFlagB(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-bold text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Venue Stadium</label>
              <input
                type="text"
                placeholder="MetLife Stadium"
                value={newVenue}
                onChange={(e) => setNewVenue(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-medium text-xs text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">City, Region</label>
              <input
                type="text"
                placeholder="East Rutherford, NJ"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-medium text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date Label</label>
              <input
                type="text"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-medium text-xs text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lock Status Stage</label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 font-bold text-xs text-slate-800 cursor-pointer"
              >
                <option value="UPCOMING">UPCOMING (Open to predictions)</option>
                <option value="LIVE">LIVE</option>
                <option value="FINISHED">FINISHED</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1.5 py-3 bg-[#2A398D] text-white hover:bg-[#3CAC3B] rounded-xl font-bold text-xs uppercase transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create Match Card
          </button>
        </form>
      )}

      {/* Sub-tab 3: EXPORT EXCEL LOGS */}
      {activeSubTab === 'export' && (
        <div className="text-center p-8 border border-dashed rounded-3xl space-y-4">
          <div className="mx-auto w-12 h-12 bg-[#3CAC3B]/10 rounded-2xl flex items-center justify-center text-[#3CAC3B]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h4 className="text-sm font-black text-slate-800">Export Leaderboard Records</h4>
            <p className="text-slate-500 text-xs">
              Generate a clean, Excel-compatible CSV list of employee total scoring points, ranks, and metadata.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 bg-[#3CAC3B] text-white hover:bg-emerald-600 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 mx-auto cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Download Leaderboard .CSV
          </button>
        </div>
      )}
    </div>
  );
}
