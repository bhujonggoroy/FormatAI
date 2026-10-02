import React, { useState } from "react";
import { Menu, Pencil } from "lucide-react";
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
    <header className="h-10 border-b border-slate-200 bg-white sticky top-0 z-30 transition-all w-full select-none shrink-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: 3-Lines Bar (Hamburger) + Brand */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            id="btn-hamburger-menu"
            type="button"
            onClick={onToggleSidebar}
            className="h-7 w-7 sm:h-7.5 sm:w-7.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-2xs"
            title="Open Settings, AI Providers & Academic Skills Drawer"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4 text-slate-900 stroke-[2.5]" />
          </button>

          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            <FormatAILogo variant="icon" size="sm" />
            <div
              className="flex items-baseline tracking-normal leading-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              <span className="font-extrabold text-[#362218] text-base tracking-tight">
                Format
              </span>
              <span className="font-extrabold text-[#B85028] text-base ml-0.5 tracking-tight">
                AI
              </span>
            </div>
          </div>

          {/* Theme badge indicator */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold"
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

        {/* Center/Right: Document title box (Merged app bar and file name: inline-editable text with pencil) */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-xs sm:max-w-md w-full justify-end">
          <div className="relative flex items-center w-full group">
            <input
              id="header-doc-title"
              type="text"
              value={docTitle}
              onChange={(e) => onDocTitleChange(e.target.value)}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              placeholder="Untitled Document"
              className="text-xs sm:text-[13px] font-semibold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-slate-400 rounded-lg px-2 py-1 transition-all truncate w-full pr-7 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-400 cursor-text"
              title="Click to rename document"
            />
            <Pencil className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none group-hover:text-slate-600 transition-colors shrink-0" />
          </div>
        </div>
      </div>
    </header>
  );
};
