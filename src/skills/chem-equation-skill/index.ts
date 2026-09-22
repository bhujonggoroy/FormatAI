import { Skill } from "../types";

/**
 * Skill 6: Chemical Equations & Stoichiometry
 * Based on https://github.com/K-Dense-AI/chem-equation-skill
 * 
 * Priority 2: Scientific formatting.
 * Handles chemistry stoichiometry, mhchem reaction equations, chemical formulas,
 * ionic charges, oxidation states, and thermochemical reaction equations.
 */
export const chemEquationSkill: Skill = {
  id: "chem-equation-skill",
  name: "Chemical Equations & Stoichiometry",
  shortName: "Chemistry & Reactions",
  version: "1.1.0",
  author: "K-Dense-AI",
  repositoryUrl: "https://github.com/K-Dense-AI/chem-equation-skill",
  license: "Apache-2.0",
  role: "Formats chemical reactions, stoichiometric equations, molecular formulas with subscripts, reaction conditions, and states of matter.",
  description:
    "Formats chemical formulas (H2O, CO2, H2SO4), reaction arrows (->, <=>, equilibrium), states of matter ((s), (l), (g), (aq)), ionic charges (Ca2+, SO4^2-), and stoichiometric balances adhering to IUPAC standards.",
  priority: 2, // 2: Scientific formatting
  category: "scientific",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Automatic stoichiometric formula subscripting (C6H12O6, H2SO4, Fe2O3)",
    "Standard reaction arrows (\\rightarrow, \\rightleftharpoons for equilibrium)",
    "States of matter preservation in Roman parentheses: (s), (l), (g), (aq)",
    "Ionic superscript charges with signs: Na+, Cl-, Fe^3+, SO_4^{2-}",
    "Thermochemical notation: \\Delta H^\\circ, \\Delta G^\\circ, \\Delta S^\\circ in kJ/mol",
    "Precipitation (\\downarrow) and gas evolution (\\uparrow) arrows",
  ],
  rules: [
    {
      id: "chem-stoichiometry",
      name: "Chemical Reaction Balancing",
      description: "Convert informal reaction arrows -> and <=> into standard LaTeX chemical reaction arrows.",
      exampleInput: "2H2 + O2 -> 2H2O",
      exampleOutput: "$2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O}$",
    },
    {
      id: "chem-states",
      name: "States of Matter Typesetting",
      description: "Ensure states of matter are rendered in Roman text: (s), (l), (g), (aq).",
      exampleInput: "NaCl(aq) + AgNO3(aq) -> AgCl(s) + NaNO3(aq)",
      exampleOutput: "$\\text{NaCl}(aq) + \\text{AgNO}_3(aq) \\rightarrow \\text{AgCl}(s) + \\text{NaNO}_3(aq)$",
    },
    {
      id: "chem-ions",
      name: "Ionic Superscripts",
      description: "Format ionic charges as superscripts with magnitude preceding sign or standard sign notations.",
      exampleInput: "Ca2+ + 2OH- -> Ca(OH)2",
      exampleOutput: "$\\text{Ca}^{2+} + 2\\text{OH}^- \\rightarrow \\text{Ca(OH)}_2$",
    },
  ],
  systemPromptInstruction: `[SKILL: Chemical Equations & Stoichiometry (chem-equation-skill)]
- Express chemical equations with upright element symbols: \\text{H}_2\\text{O}, \\text{CO}_2, \\text{H}_2\\text{SO}_4.
- Use \\rightarrow for forward reactions, \\rightleftharpoons for chemical equilibrium.
- Format states of matter as (s), (l), (g), (aq) without italicization.
- Format ionic charges with superscripts: \\text{Fe}^{3+}, \\text{SO}_4^{2-}.
- Enthalpy changes should be formatted as $\\Delta H^\\circ = -285.8\\text{ kJ/mol}$.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Common chemical molecular formulas replacement (when not already inside LaTeX commands)
    s = s.replace(/\bH2O\b/g, "\\text{H}_2\\text{O}");
    s = s.replace(/\bCO2\b/g, "\\text{CO}_2");
    s = s.replace(/\bO2\b/g, "\\text{O}_2");
    s = s.replace(/\bN2\b/g, "\\text{N}_2");
    s = s.replace(/\bH2\b/g, "\\text{H}_2");
    s = s.replace(/\bCH4\b/g, "\\text{CH}_4");
    s = s.replace(/\bNH3\b/g, "\\text{NH}_3");
    s = s.replace(/\bH2SO4\b/g, "\\text{H}_2\\text{SO}_4");
    s = s.replace(/\bHCl\b/g, "\\text{HCl}");
    s = s.replace(/\bNaOH\b/g, "\\text{NaOH}");
    s = s.replace(/\bNaCl\b/g, "\\text{NaCl}");
    s = s.replace(/\bCaCO3\b/g, "\\text{CaCO}_3");
    s = s.replace(/\bC6H12O6\b/g, "\\text{C}_6\\text{H}_{12}\\text{O}_6");

    // Replace chemical reaction arrows
    s = s.replace(/\s*<==?>\s*/g, " \\rightleftharpoons ");
    s = s.replace(/\s*<=>\s*/g, " \\rightleftharpoons ");

    return s;
  },
};
