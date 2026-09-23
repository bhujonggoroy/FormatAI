import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { STATUS_SIGNAL_GUIDE } from "../utils/aiStatusClassifier";

interface StatusSignalGuideProps {
  className?: string;
  defaultExpanded?: boolean;
}

export const StatusSignalGuide: React.FC<StatusSignalGuideProps> = ({
  className = "",
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      id="status-signal-guide-panel"
      className={`rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs overflow-hidden transition-all ${className}`}
    >
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 bg-slate-100/90 hover:bg-slate-200/70 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer transition-colors"
        aria-expanded={isExpanded}
        aria-controls="status-signal-guide-content"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">🚦</span>
          <span className="text-xs font-black text-slate-800 tracking-tight truncate">
            Status Signal Guide
          </span>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
            (Legend & Road Signs)
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-500">
          <span className="text-[10px] font-bold">
            {isExpanded ? "Hide" : "Show Legend"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Signal Direction Board Grid */}
      {isExpanded && (
        <div
          id="status-signal-guide-content"
          className="p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs"
        >
          {STATUS_SIGNAL_GUIDE.map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-start gap-2 text-left hover:border-slate-300 transition-colors"
            >
              <span className="text-sm shrink-0 mt-0.5" aria-hidden="true">
                {item.signal}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.2 rounded font-black text-[10px] uppercase border tracking-wider ${item.color}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-snug">
                  {item.meaning}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
