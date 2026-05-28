/**
 * Onboarding.tsx
 *
 * Shown ONCE per user immediately after their first Google login.
 * Collects Department + Site (HiBob fallback) and records T&C acceptance.
 *
 * On submit → POST /api/auth/onboarding  (stores dept, site, termsAcceptedAt in DB)
 * On success → calls onComplete({ department, site }) so App updates in-memory user.
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, CheckCircle, ChevronDown, Loader2 } from 'lucide-react';

// Fallback lists — used if the /api/auth/lists fetch fails
const FALLBACK_DEPARTMENTS = [
  'AI','Customer Experience','Customer Success','Data & Information Systems',
  'Engineering','Finance','G&A','Guest Communication Services','Legal',
  'Marketing','Onboarding','Operations','Payments','People','Product',
  'Product Design','Professional Services','R&D','RU G&A','Sales',
  'StaySense Tech','Strategy',
];

const FALLBACK_SITES = [
  'Australia','Canada','Colombia','Dubai','France','Ireland','Israel','Mexico',
  'Netherlands','Panama','Philippines','Poland','Portugal','Remote','Spain',
  'Sweden','Switzerland','Turkey','UK','Ukraine','US - East','US - West',
];

const TERMS_TEXT = `Welcome to the Guessy by Guesty!

Hi Guesties! Before you make your first predictions, please review and accept our quick ground rules to keep the competition fair and fun for everyone:
This game is open to all active internal employees of Guesty. Participation is 100% voluntary.
Fair Play & Limitations: Limit of one entry/prediction per person per match. Any entries submitted after the matches start will not be counted.
Prizes are non-transferable and cannot be exchanged for cash. Please note that depending on your local country's tax regulations, the value of the prize may be subject to standard gift tax reporting on your payroll.
The app will securely process your employee ID, name, and prediction data solely for the purposes of calculating scores, displaying leaderboards, and distributing prizes.
The Organizing Team reserves the right to make the final determination in the event of a tie, technical glitch, or dispute.
By clicking "I Accept", you agree to these rules and are ready to lock in your first guess!`;

// ─── Component ────────────────────────────────────────────────────────────────

interface OnboardingProps {
  currentUser: { email: string; fullName: string; department: string; site: string };
  authToken: string;
  onComplete: (updates: { department: string; site: string }) => void;
}

const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function Onboarding({ currentUser, authToken, onComplete }: OnboardingProps) {
  // Live lists from HiBob — loaded on mount
  const [departments, setDepartments] = useState<string[]>(FALLBACK_DEPARTMENTS);
  const [sites, setSites]             = useState<string[]>(FALLBACK_SITES);
  const [listsLoading, setListsLoading] = useState(true);

  // Pre-select HiBob data if available, otherwise leave blank so user must pick
  const [department, setDepartment] = useState<string>(
    currentUser.department !== 'Unknown' ? currentUser.department : ''
  );
  const [site, setSite] = useState<string>(
    currentUser.site !== 'Unknown' ? currentUser.site : ''
  );
  const [termsChecked, setTermsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch live department + site lists from HiBob via backend
  useEffect(() => {
    fetch(`${API_URL}/api/auth/lists`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { departments: string[]; sites: string[] }) => {
        if (data.departments?.length) setDepartments(data.departments);
        if (data.sites?.length)       setSites(data.sites);
        // Re-validate pre-selected values against fresh lists
        if (currentUser.department !== 'Unknown' && data.departments?.includes(currentUser.department)) {
          setDepartment(currentUser.department);
        }
        if (currentUser.site !== 'Unknown' && data.sites?.includes(currentUser.site)) {
          setSite(currentUser.site);
        }
      })
      .catch(() => { /* keep fallback lists */ })
      .finally(() => setListsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = department && site && termsChecked && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ department, site }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Something went wrong. Please try again.');
      }

      onComplete({ department, site });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden my-auto border-t-4 border-[#14665F]"
      >
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#14665F]/5 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#072C23]/5 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="bg-[#072C23] px-6 py-7 text-white text-center relative">
          <div className="w-14 h-14 bg-[#14665F] rounded-2xl flex items-center justify-center shadow-lg shadow-[#14665F]/30 mx-auto mb-3">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Welcome, {currentUser.fullName.split(' ')[0]}! 🎉</h2>
          <p className="text-white/60 text-xs font-medium mt-1">
            One quick step before your first prediction
          </p>
        </div>

        <div className="p-6 space-y-5 relative z-10">

          {/* Email — read-only */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Your Guesty Email
            </label>
            <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-500 select-none">
              {currentUser.email}
            </div>
          </div>

          {/* Department dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Your Department <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={listsLoading}
                className="w-full appearance-none px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#14665F] transition-colors cursor-pointer pr-10 disabled:opacity-50"
              >
                <option value="" disabled>
                  {listsLoading ? 'Loading departments…' : 'Select your department…'}
                </option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {listsLoading
                ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              }
            </div>
          </div>

          {/* Site / Office dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Your Office / Location <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={site}
                onChange={(e) => setSite(e.target.value)}
                disabled={listsLoading}
                className="w-full appearance-none px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#14665F] transition-colors cursor-pointer pr-10 disabled:opacity-50"
              >
                <option value="" disabled>
                  {listsLoading ? 'Loading offices…' : 'Select your office…'}
                </option>
                {sites.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {listsLoading
                ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              }
            </div>
          </div>

          {/* T&C scrollable box */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Terms &amp; Conditions
            </label>
            <div className="h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">
              {TERMS_TEXT}
            </div>
          </div>

          {/* T&C checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group select-none">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  termsChecked
                    ? 'bg-[#14665F] border-[#14665F]'
                    : 'bg-white border-slate-300 group-hover:border-[#14665F]/50'
                }`}
              >
                {termsChecked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-600 leading-relaxed">
              I have read and agree to the Terms &amp; Conditions above. I understand the rules of the Guesty World Cup Prediction Challenge.
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              canSubmit
                ? 'bg-[#14665F] text-white hover:bg-[#072C23] shadow-lg shadow-[#14665F]/20 active:scale-95 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                I Accept &amp; Let's Play! ⚽
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            This dialog only appears once. Your selections are saved to your profile.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
