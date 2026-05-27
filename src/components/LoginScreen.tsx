import { useState, FormEvent } from 'react';
import { Mail, User, Building, MapPin, ArrowRight, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { GUESTY_DEPARTMENTS, GUESTY_SITES } from '../data/mockData';
import GuestyLogo from './GuestyLogo';

interface LoginScreenProps {
  onLogin: (profile: { fullName: string; email: string; department: string; site: string }) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState(GUESTY_DEPARTMENTS[0]);
  const [site, setSite] = useState(GUESTY_SITES[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid company email address');
      return;
    }
    setError('');
    onLogin({
      fullName: fullName.trim(),
      email: email.trim(),
      department,
      site,
    });
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative soccer stadium overlay elements with the brand palette */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-nature/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-teal/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,16,16,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,16,16,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 35, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden relative z-10"
        id="login-container"
      >
        {/* Banner with Guesty premium branding - using forest green color #072C23 */}
        <div className="bg-[#072C23] px-6 py-9 text-cream relative text-center border-b border-nature/20">
          <div className="absolute top-4 right-4 text-[#EEFAD0]">
            <Star className="w-5 h-5 fill-[#EEFAD0] animate-pulse" />
          </div>
          <div className="mb-4">
            <GuestyLogo className="h-10 text-[#EEFAD0]" color="#EEFAD0" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-teal">Guesty Brand Challenge 2026</p>
          <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1 text-white">World Cup Prediction Challenge</h2>
          <p className="text-cream/70 text-xs mt-1 max-w-xs mx-auto font-medium">
            Place your forecasts, score points, and lead your local Guesty office on the corporate leaderboard!
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 bg-white">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Elizabeth Bennet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14665F] focus:bg-white transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                placeholder="name@guesty.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14665F] focus:bg-white transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-[#14665F] focus:bg-white cursor-pointer"
                >
                  {GUESTY_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Guesty Site</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-[#14665F] focus:bg-white cursor-pointer"
                >
                  {GUESTY_SITES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 mt-2 bg-[#14665F] text-white hover:bg-[#072C23] rounded-2xl font-bold tracking-wide transition-all duration-300 shadow-md shadow-[#14665F]/20 hover:shadow-[#072C23]/20 transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm uppercase"
            id="login-btn-submit"
          >
            Start Predicting
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>

      {/* Small footnote */}
      <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 tracking-widest relative z-10 select-none">
        ⚽ Guesty Sports Challenge • World Cup Challenge Portal
      </p>
    </div>
  );
}
