export interface AcademicTheme {
  id: string;
  label: string;
  hex: string;
  desc: string;
  lightBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  btnPrimary: string;
  btnHover: string;
  ring: string;
}

export const ACADEMIC_THEMES: AcademicTheme[] = [
  {
    id: "oxford_navy",
    label: "Oxford Navy",
    hex: "#1A365D",
    desc: "Traditional University Oxford Blue",
    lightBg: "#F0F4F8",
    border: "#93C5FD",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
    btnPrimary: "#1A365D",
    btnHover: "#102A4C",
    ring: "#3B82F6",
  },
  {
    id: "royal_azure",
    label: "Royal Azure",
    hex: "#1D4ED8",
    desc: "Vibrant Science & Engineering Blue",
    lightBg: "#EFF6FF",
    border: "#93C5FD",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
    btnPrimary: "#1D4ED8",
    btnHover: "#1E40AF",
    ring: "#60A5FA",
  },
  {
    id: "forest_emerald",
    label: "Cambridge Emerald",
    hex: "#065F46",
    desc: "Natural Science & Cambridge Forest",
    lightBg: "#ECFDF5",
    border: "#A7F3D0",
    badgeBg: "#D1FAE5",
    badgeText: "#065F46",
    btnPrimary: "#065F46",
    btnHover: "#044E39",
    ring: "#10B981",
  },
  {
    id: "crimson_burgundy",
    label: "Crimson Burgundy",
    hex: "#881337",
    desc: "Ivy League Crimson & University Rose",
    lightBg: "#FFF1F2",
    border: "#FECDD3",
    badgeBg: "#FFE4E6",
    badgeText: "#881337",
    btnPrimary: "#881337",
    btnHover: "#700F2E",
    ring: "#F43F5E",
  },
  {
    id: "imperial_violet",
    label: "Imperial Violet",
    hex: "#4338CA",
    desc: "Distinguished Academic Purple & Plum",
    lightBg: "#EEF2FF",
    border: "#C7D2FE",
    badgeBg: "#E0E7FF",
    badgeText: "#3730A3",
    btnPrimary: "#4338CA",
    btnHover: "#3730A3",
    ring: "#6366F1",
  },
  {
    id: "slate_charcoal",
    label: "Slate Charcoal",
    hex: "#1E293B",
    desc: "Minimalist Modern Obsidian & Charcoal",
    lightBg: "#F1F5F9",
    border: "#CBD5E1",
    badgeBg: "#E2E8F0",
    badgeText: "#0F172A",
    btnPrimary: "#1E293B",
    btnHover: "#0F172A",
    ring: "#64748B",
  },
  {
    id: "warm_amber",
    label: "Amber Bronze",
    hex: "#B45309",
    desc: "Classical Humanities Bronze & Ochre",
    lightBg: "#FFFBEB",
    border: "#FDE68A",
    badgeBg: "#FEF3C7",
    badgeText: "#92400E",
    btnPrimary: "#B45309",
    btnHover: "#92400E",
    ring: "#F59E0B",
  },
  {
    id: "teal_peacock",
    label: "Teal Peacock",
    hex: "#0F766E",
    desc: "Medical & Applied Sciences Teal",
    lightBg: "#F0FDFA",
    border: "#99F6E4",
    badgeBg: "#CCFBF1",
    badgeText: "#115E59",
    btnPrimary: "#0F766E",
    btnHover: "#115E59",
    ring: "#14B8A6",
  },
];

export function getAcademicTheme(hex: string): AcademicTheme {
  const match = ACADEMIC_THEMES.find(
    (t) => t.hex.toLowerCase() === hex.toLowerCase()
  );
  if (match) return match;

  return {
    id: "custom",
    label: "Custom Palette",
    hex: hex,
    desc: "User Selected Accent",
    lightBg: "#F8FAFC",
    border: "#E2E8F0",
    badgeBg: "#E2E8F0",
    badgeText: "#0F172A",
    btnPrimary: hex,
    btnHover: hex,
    ring: hex,
  };
}
