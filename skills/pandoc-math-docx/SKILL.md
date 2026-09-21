---
name: pandoc-math-docx
version: 1.3.0
author: Kantyc
repository: https://github.com/Kantyc/pandoc-math-docx
priority: 1
category: pandoc
---

# Math + LaTeX → Editable DOCX (pandoc-math-docx)

## Overview
Emulates the robust Pandoc document conversion pipeline that translates LaTeX mathematical expressions into Microsoft Word native OMML equations. Guarantees delimiter fidelity, multi-line equation alignment, and macro cleanup.

## Core Capabilities
1. **Delimiter Normalization**: Normalizes all standard and non-standard math delimiters: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`.
2. **Aligned Equation Environments**: Preserves alignment points (`&`) and row breaks (`\\`) in `\begin{aligned}` and `\begin{align*}` environments.
3. **Macro & Symbol Standardization**: Maps LaTeX macros and Greek letters to standard OMML characters.
4. **Piecewise Conditions**: Formats `\begin{cases} ... \end{cases}` environments for conditional expressions.
5. **Bracket Balancing**: Automatically matches open and closing delimiters `\left( ... \right)`.
