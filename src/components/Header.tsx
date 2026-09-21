import React, { useState } from "react";
import { Menu, Pencil } from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";

interface HeaderProps {
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  docTitle,
  onDocTitleChange,
  onToggleSidebar,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-sm sticky top-0 z-30 transition-all w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: 3-Lines Bar (Hamburger) + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* 3-lines bar (hamburger icon) */}
          <button
            id="btn-hamburger-menu"
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Open Settings & Configuration Menu"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 select-none">
            <FormatAILogo variant="icon" size="sm" />
            <div
              className="flex items-baseline tracking-normal leading-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              <span className="font-bold text-[#362218] text-lg sm:text-[22px] tracking-tight">
                Format
              </span>
              <span className="font-bold text-[#B85028] text-lg sm:text-[22px] ml-0.5 tracking-tight">
                AI
              </span>
            </div>
          </div>

          {/* Divider */}
          <span className="text-slate-300 text-lg font-light select-none px-0.5 shrink-0">
            |
          </span>
        </div>

        {/* Center/Right: Full space for clearly visible light file name box on all devices */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative flex items-center w-full group">
            <input
              id="header-doc-title"
              type="text"
              value={docTitle}
              onChange={(e) => onDocTitleChange(e.target.value)}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              placeholder="File Name"
              className="text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-300/90 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-1.5 transition-all truncate w-full pr-8 shadow-2xs placeholder:text-slate-500 placeholder:font-medium"
              title="Click to rename document"
            />
            <Pencil className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none group-hover:text-slate-600 transition-colors shrink-0" />
          </div>

          {/* Pill badge: 'File name' — hidden on mobile view as requested, visible on larger screens */}
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-200/80 border border-slate-300/80 rounded-full select-none shrink-0 whitespace-nowrap">
            File name
          </span>
        </div>
      </div>
    </header>
  );
};

