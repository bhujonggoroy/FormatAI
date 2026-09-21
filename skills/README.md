# Modular Skills System

This directory contains the modular skill specifications and instruction standards integrated into the NotebookLM → DOCX Converter application.

## Integrated Skills & Priority Order

When multiple skills affect the same content, transformations are strictly executed in the following priority order:

| Priority | Skill | Source Repository | Category | Description |
|---|---|---|---|---|
| **1** | **Math → Native Word Equation** (`math-docx`) | [`Future-3526038670/docx-math-skill`](https://github.com/Future-3526038670/docx-math-skill) | Mathematics | Converts LaTeX and math equations into native Microsoft Word Office Math (OMML). Ensures equations are fully editable Word objects, never static images. |
| **1** | **Math + LaTeX → Editable DOCX** (`pandoc-math-docx`) | [`Kantyc/pandoc-math-docx`](https://github.com/Kantyc/pandoc-math-docx) | Pandoc / LaTeX | Pandoc-compatible TeX delimiter normalization (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`), environment parsing, and alignment handling. |
| **2** | **Scientific + DOCX** (`scientific-docx`) | [`K-Dense-AI/scientific-agent-skills`](https://github.com/K-Dense-AI/scientific-agent-skills) | Scientific | Standardizes scientific exponential notation ($1.5 \times 10^{-4}$), compound SI measurement units, chemical formulas, and measurement uncertainties ($\pm$). |
| **3** | **Academic/Scientific Manuscript** (`academic-manuscript`) | [`kchemorion/academic-manuscript-skill`](https://github.com/kchemorion/academic-manuscript-skill) | Academic | Formats IMRAD manuscript structures, APA/IEEE citations, Booktabs three-line publication tables, and figure/table captions. |
| **4** | **General Text Formatting** | Built-in Base Engine | General | Typographic hierarchy, fonts, headers, callouts, and page layouts. |

## Directory Structure

- `math-docx/`: OMML native Word math formulas, stacked fractions, radicals, sums, products, limits, and operators.
- `scientific-docx/`: Scientific notation, SI units, chemical subscripts, uncertainties, and significant figures.
- `pandoc-math-docx/`: Pandoc TeX delimiters, align environments, macros, and bracket balance.
- `academic-manuscript/`: Manuscript sections, Booktabs tables, citations, and figure/table captions.
