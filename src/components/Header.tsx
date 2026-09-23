import React, { useState } from "react";
import { Menu, Pencil, Palette } from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";
import { getAcademicTheme } from "../utils/theme";

interface HeaderProps {
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onToggleSidebar: () => void;
  accentColor?: string;
}

export const Header: React.FC<HeaderProps> = ({
  docTitle,
  onDocTitleChange,
  onToggleSidebar,
  accentColor = "#1A365D",
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const currentTheme = getAcademicTheme(accentColor);

  return (
    <header className="border-b-2 border-slate-300 bg-white sticky top-0 z-30 transition-all w-full shadow-2xs">
      {/* Top dynamic theme color bar for full visual harmony */}
      <div
        className="h-1 w-full transition-colors duration-300"
        style={{ backgroundColor: currentTheme.hex }}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: 3-Lines Bar (Hamburger) + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* 3-lines bar (hamburger icon) */}
          <button
            id="btn-hamburger-menu"
            type="button"
            onClick={onToggleSidebar}
            className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] p-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-2xs"
            title="Open Settings, AI Providers & Academic Skills Drawer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-slate-900 stroke-[2.5]" />
          </button>

          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 select-none">
            <FormatAILogo variant="icon" size="sm" />
            <div
              className="flex items-baseline tracking-normal leading-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              <span className="font-extrabold text-[#362218] text-base sm:text-[22px] tracking-tight">
                Format
              </span>
              <span className="font-extrabold text-[#B85028] text-base sm:text-[22px] ml-0.5 tracking-tight">
                AI
              </span>
            </div>
          </div>

          {/* Theme badge indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold"
            style={{
              backgroundColor: currentTheme.badgeBg,
              color: currentTheme.badgeText,
              borderColor: currentTheme.border,
            }}
          >
            <span
              className="w-2 h-2 rounded-full border border-white"
              style={{ backgroundColor: currentTheme.hex }}
            />
            <span>{currentTheme.label}</span>
          </div>
        </div>

        {/* Center/Right: Document title box */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end max-w-lg">
          <div className="relative flex items-center w-full group">
            <input
              id="header-doc-title"
              type="text"
              value={docTitle}
              onChange={(e) => onDocTitleChange(e.target.value)}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              placeholder="Document Title"
              className="text-xs sm:text-sm font-extrabold text-slate-900 bg-slate-100 hover:bg-white focus:bg-white border-2 border-slate-300 hover:border-slate-400 focus:border-slate-800 rounded-xl px-3 py-1.5 sm:py-2 transition-all truncate w-full pr-8 shadow-2xs placeholder:text-slate-400"
              title="Click to rename document"
            />
            <Pencil className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 pointer-events-none group-hover:text-slate-700 transition-colors shrink-0" />
          </div>

          <span className="hidden md:inline-flex items-center px-2.5 py-1.5 text-[11px] font-extrabold text-slate-800 bg-slate-100 border-2 border-slate-300 rounded-xl select-none shrink-0 whitespace-nowrap shadow-2xs">
            File name
          </span>
        </div>
      </div>
    </header>
  );
};
