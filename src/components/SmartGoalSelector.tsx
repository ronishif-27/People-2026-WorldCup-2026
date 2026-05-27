import { Plus, Minus } from 'lucide-react';

interface SmartGoalSelectorProps {
  teamName: string;
  flag: string;
  value: number;
  onChange: (val: number) => void;
}

export function SmartGoalSelector({
  teamName,
  flag,
  value,
  onChange,
}: SmartGoalSelectorProps) {
  const increment = () => {
    onChange(value + 1);
  };

  const decrement = () => {
    if (value > 0) {
      onChange(value - 1);
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl relative">
      <div className="flex items-center gap-1.5 mb-2 h-6 px-1 max-w-full justify-center">
        <span className="text-xl filter drop-shadow-xs leading-none shrink-0">{flag}</span>
        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter truncate max-w-[110px] sm:max-w-none text-center">
          {teamName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Decrement Touch Target - 44px x 44px min */}
        <button
          type="button"
          onClick={decrement}
          className={`w-11 h-11 flex items-center justify-center rounded-full bg-white border text-slate-600 hover:text-[#2A398D] shadow-xs active:bg-slate-100 transition-colors select-none cursor-pointer ${
            value === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          aria-label={`Decrease predicted goals for ${teamName}`}
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Display Score value */}
        <span className="font-mono text-3xl font-black text-slate-800 w-10 text-center select-none">
          {value}
        </span>

        {/* Increment Touch Target - 44px x 44px min */}
        <button
          type="button"
          onClick={increment}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white border text-slate-600 hover:text-[#2A398D] shadow-xs active:bg-slate-100 transition-colors select-none cursor-pointer"
          aria-label={`Increase predicted goals for ${teamName}`}
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">
        Goals
      </span>
    </div>
  );
}
