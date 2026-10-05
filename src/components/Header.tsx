import React, { useState } from "react";
import { Menu, Pencil } from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";
import { getAcademicTheme } from "../utils/theme";

interface HeaderProps {
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  accentColor?: string;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  docTitle,
  onDocTitleChange,
  onToggleSidebar,
  isSidebarOpen = false,
  accentColor = "#881337",
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const currentTheme = getAcademicTheme(accentColor);

  return (
    <header className="h-11 sm:h-10 border-b border-slate-300 bg-white sticky top-0 z-30 transition-all w-full select-none shrink-0 shadow-2xs" style={{ paddingLeft: "max(0px, env(safe-area-inset-left))", paddingRight: "max(0px, env(safe-area-inset-right))" }}>
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 h-full flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Left: 3-Lines Bar (Hamburger / Menu Button) + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            id="btn-hamburger-menu"
            type="button"
            onClick={onToggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-controls="sidebar-settings-drawer"
            className="h-10 w-10 sm:h-8 sm:w-8 min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] rounded-xl text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
            title={isSidebarOpen ? "Close Navigation & Settings Menu (Esc)" : "Open Navigation, Settings & Academic Skills Menu"}
            aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation, settings and tools menu"}
          >
            <Menu className="w-5 h-5 sm:w-4.5 sm:h-4.5 text-slate-900 stroke-[2.5]" />
          </button>

          {/* Brand Logo & Name */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 select-none">
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
        <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[130px] xs:max-w-xs sm:max-w-md justify-end">
          <div className="relative flex items-center w-full group">
            <label htmlFor="header-doc-title" className="sr-only">
              Document Title
            </label>
            <input
              id="header-doc-title"
              type="text"
              value={docTitle}
              onChange={(e) => onDocTitleChange(e.target.value)}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              placeholder="Untitled Document"
              className="text-xs sm:text-[13px] font-semibold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-slate-400 rounded-lg px-2 sm:px-2.5 py-1.5 transition-all truncate w-full pr-6 sm:pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] placeholder:text-slate-400 cursor-text min-h-[36px]"
              title="Click to rename document"
              aria-label="Document Title"
            />
            <Pencil className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none group-hover:text-slate-600 transition-colors shrink-0" />
          </div>
        </div>
      </div>
    </header>
  );
});
