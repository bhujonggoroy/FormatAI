import { Skill } from "../types";

/**
 * Skill 2: Scientific + DOCX
 * Based on https://github.com/K-Dense-AI/scientific-agent-skills
 * 
 * Priority 2: Scientific formatting.
 * Preserves and standardizes scientific notation, SI units, chemical formulas,
 * physical constants, and scientific data measurement structures.
 */
export const scientificDocxSkill: Skill = {
  id: "scientific-docx",
  name: "Scientific + DOCX",
  shortName: "Scientific Notation & Units",
  version: "1.4.1",
  author: "K-Dense-AI",
  repositoryUrl: "https://github.com/K-Dense-AI/scientific-agent-skills",
  description:
    "Standardizes scientific notations, SI measurement units, chemical formulas, physical constants, and empirical data tables with measurement uncertainties for scientific and engineering reports.",
  priority: 2, // 2: Scientific formatting
  category: "scientific",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Scientific exponential notation formatting (e.g. 1.5 × 10⁻⁴)",
    "Standardized SI measurement units (m/s², kg·m/s², mol/L, kJ/mol, μm, kHz)",
    "Chemical molecular formula subscripting (H₂O, CO₂, C₆H₁₂O₆, H₂SO₄)",
    "Preservation of experimental uncertainties (± 0.05, 95% CI)",
    "Physical constants rendering (c, h, k_B, N_A, R, G, ε₀)",
    "Scientific significant figures and decimal alignment in tables",
  ],
  rules: [
    {
      id: "scientific-notation",
      name: "Exponential & Scientific Notation",
      description: "Convert informal notation like 1.5 x 10^-4 or 3.0e8 into standard LaTeX scientific notation $1.5 \\times 10^{-4}$ and $3.0 \\times 10^{8}$.",
      exampleInput: "Velocity = 3.0 x 10^8 m/s, conc = 2.5e-3 mol/L",
      exampleOutput: "Velocity = $3.0 \\times 10^{8}\\text{ m/s}$, conc = $2.5 \\times 10^{-3}\\text{ mol/L}$",
    },
    {
      id: "chemical-formulas",
      name: "Chemical Formula Subscripts",
      description: "Ensure molecular formulas format subscripted stoichiometric coefficients correctly (H2O -> \\text{H}_2\\text{O}, CO2 -> \\text{CO}_2).",
      exampleInput: "6CO2 + 6H2O -> C6H12O6 + 6O2",
      exampleOutput: "$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$",
    },
    {
      id: "si-units",
      name: "SI Units & Dimensions",
      description: "Format compound SI units with roman lettering and proper superscripts (m/s^2 -> \\text{m/s}^2 or \\text{m}\\cdot\\text{s}^{-2}).",
      exampleInput: "Acceleration is 9.81 m/s^2; density is 1000 kg/m^3",
      exampleOutput: "Acceleration is $9.81\\text{ m/s}^2$; density is $1000\\text{ kg/m}^3$",
    },
    {
      id: "measurement-uncertainty",
      name: "Measurement Uncertainties & Intervals",
      description: "Preserve experimental uncertainties with \\pm notation (e.g. 25.4 ± 0.2 mm or 95% CI [23.1, 27.8]).",
      exampleInput: "Mass = 12.45 +/- 0.05 g",
      exampleOutput: "Mass = $12.45 \\pm 0.05\\text{ g}$",
    },
  ],
  systemPromptInstruction: `[SKILL: Scientific + DOCX (scientific-agent-skills)]
- Format scientific numbers in standard scientific notation: use a \\times 10^{b} (e.g., $1.5 \\times 10^{-4}$, $6.022 \\times 10^{23}$).
- Standardize SI units: use standard unit symbols inside \\text{...} or roman font (e.g., $\\text{m/s}^2$, $\\text{kg/m}^3$, $\\text{mol/L}$, $\\text{kJ/mol}$, $\\mu\\text{m}$, $\\text{kHz}$, $\\text{W/m}^2$, $\\text{Pa}$, $\\text{J}$, $\\text{N}$, $\\text{V}$, $\\Omega$, $^\\circ\\text{C}$, $\\text{K}$).
- Format chemical formulas with proper subscripts: e.g. $\\text{H}_2\\text{O}$, $\\text{CO}_2$, $\\text{C}_6\\text{H}_{12}\\text{O}_6$, $\\text{H}_2\\text{SO}_4$, $\\text{CaCO}_3$, $\\text{NaCl}$.
- Retain measurement tolerances and uncertainties: use $\\pm$ instead of '+/-'.
- In scientific tables, align numeric data, keep significant figures intact, and place units in column headers.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Convert '+/-' or '±' in numbers to \pm
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:\+\/-|±)\s*(\d+(?:\.\d+)?)/g, "$1 \\pm $2");

    // Scientific notation: 1.5 x 10^-4 or 1.5 * 10^4 or 1.5 × 10⁻⁴
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:[xX*×]|\btimes\b)\s*10\^?\{?([+-]?\d+)\}?/g, (_m, v1, v2) => `$${v1} \\times 10^{${v2}}$`);

    // Scientific notation e-notation: 3.5e-4 or 2.1e+6 (when preceded by space or equals, not inside word)
    s = s.replace(/(?<=[ =(:])(\d+(?:\.\d+)?)e([+-]?\d+)\b/gi, (_m, v1, v2) => `$${v1} \\times 10^{${v2}}$`);

    // Merge adjacent math and units: $3.0 \times 10^{8}$ m/s^2 -> $3.0 \times 10^{8}\text{ m/s}^2$
    s = s.replace(/\$(.*?10\^?\{?[+-]?\d+\}?)\$\s*(?:m\/s\^2|m\/s2)\b/gi, "$$$1\\text{ m/s}^2$$");
    s = s.replace(/\$(.*?10\^?\{?[+-]?\d+\}?)\$\s*(?:mol\/L)\b/gi, "$$$1\\text{ mol/L}$$");
    s = s.replace(/\$(.*?10\^?\{?[+-]?\d+\}?)\$\s*(?:kg\/m\^3|kg\/m3)\b/gi, "$$$1\\text{ kg/m}^3$$");
    s = s.replace(/\$(.*?10\^?\{?[+-]?\d+\}?)\$\s*(?:kJ\/mol)\b/gi, "$$$1\\text{ kJ/mol}$$");

    // Common chemical formulas when appearing as standalone words
    const commonChemicals: [RegExp, string][] = [
      [/\bH2O\b/g, "\\text{H}_2\\text{O}"],
      [/\bCO2\b/g, "\\text{CO}_2"],
      [/\bO2\b/g, "\\text{O}_2"],
      [/\bN2\b/g, "\\text{N}_2"],
      [/\bH2\b/g, "\\text{H}_2"],
      [/\bCH4\b/g, "\\text{CH}_4"],
      [/\bNH3\b/g, "\\text{NH}_3"],
      [/\bC6H12O6\b/g, "\\text{C}_6\\text{H}_{12}\\text{O}_6"],
      [/\bH2SO4\b/g, "\\text{H}_2\\text{SO}_4"],
      [/\bHNO3\b/g, "\\text{HNO}_3"],
      [/\bCaCO3\b/g, "\\text{CaCO}_3"],
      [/\bNaCl\b/g, "\\text{NaCl}"],
      [/\bFe2O3\b/g, "\\text{Fe}_2\\text{O}_3"],
      [/\bHCl\b/g, "\\text{HCl}"],
      [/\bNaOH\b/g, "\\text{NaOH}"],
    ];

    for (const [pattern, replacement] of commonChemicals) {
      // Replace only outside existing $...$
      const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g);
      s = parts
        .map((part, idx) => {
          if (idx % 2 === 1) return part;
          return part.replace(pattern, `$${replacement}$`);
        })
        .join("");
    }

    // Common SI units with exponents: m/s^2, kg/m^3, cm^3, m^2, etc. outside math
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*(?:m\/s\^2|m\/s2)\b/gi, (_m, val) => `$${val}\\text{ m/s}^2$`);
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*(?:kg\/m\^3|kg\/m3)\b/gi, (_m, val) => `$${val}\\text{ kg/m}^3$`);
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*(?:mol\/L)\b/gi, (_m, val) => `$${val}\\text{ mol/L}$`);
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*(?:kJ\/mol)\b/gi, (_m, val) => `$${val}\\text{ kJ/mol}$`);

    // Handle exponential notation followed by units: 10^{8} m/s^2 or 10^{-4} mol/L
    s = s.replace(/(10\^?\{?[+-]?\d+\}?)\s*(?:m\/s\^2|m\/s2)\b/gi, "$1\\text{ m/s}^2");
    s = s.replace(/(10\^?\{?[+-]?\d+\}?)\s*(?:mol\/L)\b/gi, "$1\\text{ mol/L}");
    s = s.replace(/(10\^?\{?[+-]?\d+\}?)\s*(?:kg\/m\^3|kg\/m3)\b/gi, "$1\\text{ kg/m}^3");

    // Measurement uncertainty with units or values: e.g. 25.4 +/- 0.05 g -> $25.4 \pm 0.05\text{ g}$
    s = s.replace(/(\d+(?:\.\d+)?)\s*\\pm\s*(\d+(?:\.\d+)?)\s*([a-zA-Zμ]+)\b/g, (_m, v1, v2, unit) => {
      return `$${v1} \\pm ${v2}\\text{ ${unit}}$`;
    });

    return s;
  },
};
