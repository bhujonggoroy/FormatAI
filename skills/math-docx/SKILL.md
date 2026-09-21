---
name: math-docx
version: 1.2.0
author: Future-3526038670
repository: https://github.com/Future-3526038670/docx-math-skill
priority: 1
category: mathematics
---

# Math → Native Word Equation (docx-math-skill)

## Overview
Generates Microsoft Word documents (.docx) with native Office Math Markup Language (OMML) using `docx-js`. Equations are rendered as native, fully editable Word formula elements (`<m:oMath>`), never static images or unicode approximations.

## Core Capabilities
1. **Vertical Fractions (`MathFraction`)**: Vertically stacked fractions for numerator and denominator expressions.
2. **Radicals (`MathRadical`)**: Square roots and nth-degree radicals.
3. **Large Operators (`MathSum`, `MathIntegral`, `MathLimit`)**: Summations, integrals, products, and limits with lower and upper bounds.
4. **Scripts (`MathSubScript`, `MathSuperScript`, `MathSubSuperScript`)**: Subscripts, superscripts, and simultaneous sub/superscript elements.
5. **Enclosures (`MathRoundBrackets`, `MathSquareBrackets`)**: Dynamically scaled parentheses and brackets.
6. **Matrices & Arrays**: Formatted mathematical grids and systems of equations.
7. **Statistical Operators**: `\operatorname{Var}`, `\operatorname{Cov}`, `\operatorname{rank}`, `\operatorname{mode}`, `\operatorname{M.D.}`.
