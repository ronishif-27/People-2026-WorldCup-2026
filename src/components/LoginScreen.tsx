/**
 * LoginScreen.tsx
 *
 * Renders the Google Sign-In entry point.
 * Clicking the button redirects the browser to GET /api/auth/google,
 * which initiates the server-side Google OAuth 2.0 flow.
 *
 * After OAuth, the backend redirects to /auth/callback?token=<jwt>.
 * App.tsx reads the token from the URL there — LoginScreen itself
 * does not handle the callback.
 */

import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import GuestyLogo from './GuestyLogo';

// API base URL — set in .env.local as VITE_API_URL=http://localhost:8080
const API_URL = import.meta.env.VITE_API_URL ?? '';

interface LoginScreenProps {
  /** Called when an auth_error query param is present in the URL */
  authError?: string | null;
}

/** Maps backend error codes to user-friendly messages */
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. Please try again.',
  no_email: 'Google did not provide an email address. Please try a different account.',
  invalid_state: 'Your sign-in session expired. Please try again.',
  server_error: 'Something went wrong on our end. Please try again in a moment.',
  missing_params: 'Incomplete sign-in response. Please try again.',
};

export default function LoginScreen({ authError }: LoginScreenProps) {
  /** Initiate Google OAuth — full browser redirect to the backend */
  const handleGoogleSignIn = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const errorMessage = authError ? (ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.') : null;

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex flex-col justify-center items-center p-4 relative overflow-hidden">

      {/* Brand glow accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#14665F]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-[#14665F]/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,16,16,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,16,16,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 35, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden relative z-10"
      >
        {/* Header banner */}
        <div className="bg-[#072C23] px-6 py-9 text-white relative text-center border-b border-white/10">
          <div className="absolute top-4 right-4 text-[#EEFAD0]">
            <Star className="w-5 h-5 fill-[#EEFAD0] animate-pulse" />
          </div>
          <div className="mb-4">
            <GuestyLogo className="h-10 text-[#EEFAD0]" color="#EEFAD0" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8CBEBE]">
            Guesty Brand Challenge 2026
          </p>
          <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1 text-white">
            World Cup Prediction Challenge
          </h2>
          <p className="text-white/60 text-xs mt-1 max-w-xs mx-auto font-medium">
            Place your forecasts, score points, and lead your office on the global leaderboard!
          </p>
        </div>

        {/* Sign-in body */}
        <div className="p-6 md:p-8 bg-white space-y-5">

          {/* Error state */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 text-center"
            >
              {errorMessage}
            </motion.div>
          )}

          {/* Info blurb */}
          <div className="text-center space-y-1 pb-2">
            <p className="text-sm font-semibold text-slate-600">
              Sign in with your Guesty Google account to join the game.
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Your department and office are loaded automatically — no form to fill.
            </p>
          </div>

          {/* Google Sign-In button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 text-sm hover:border-[#14665F] hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
          >
            {/* Google logo SVG */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Domain notice */}
          <p className="text-center text-[11px] text-slate-400 font-medium leading-relaxed">
            Only <span className="font-bold text-[#14665F]">@guesty.com</span> accounts are permitted.
            <br />
            Contact IT if you have trouble signing in.
          </p>
        </div>
      </motion.div>

      {/* Footer tag */}
      <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 tracking-widest relative z-10 select-none">
        ⚽ Guesty Sports Challenge • World Cup 2026 Portal
      </p>
    </div>
  );
}
