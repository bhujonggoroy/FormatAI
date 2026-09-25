# FormatAI — Third-Party Licenses & Intellectual Property Review

FormatAI acknowledges and builds upon four open-source GitHub repositories. Below is the detailed legal review and attribution documentation verifying that all upstream licenses are respected and that no copyright conflicts exist.

---

## 🎯 Project Motto & Dedication

> **"ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো source থেকে পাওয়া AI-generated বা copy-pasted content-কে স্বয়ংক্রিয়ভাবে mathematical, scientific, textual এবং academic formatting সহ একটি clean, professional, editable DOCX document-এ রূপান্তর করা—শিক্ষার্থীদের জন্য সম্পূর্ণ বিনামূল্যে।"**

*English Translation:*  
*"To automatically transform AI-generated or copy-pasted content from ChatGPT, Gemini, Claude, NotebookLM or any source into a clean, professional, editable DOCX document with mathematical, scientific, textual, and academic formatting—completely free of charge for students."*

---

## 📜 Upstream Repository Reviews & Licensing Compliance

### 1. docx-math-skill
- **Repository**: [https://github.com/Future-3526038670/docx-math-skill](https://github.com/Future-3526038670/docx-math-skill)
- **Primary Focus**: Converting LaTeX mathematical expressions into native Microsoft Word Office Math Markup Language (OMML / `<m:oMath>`) and MathML structures.
- **Upstream License**: **MIT License**
- **License Terms**: Grants the right to use, copy, modify, merge, publish, distribute, sublicense, and sell copies, provided that the copyright and permission notice are preserved.
- **Compliance Status**: Fully compliant. The algorithm concepts and LaTeX-to-DOCX mappings are acknowledged with original copyright notice preserved.

### 2. scientific-agent-skills
- **Repository**: [https://github.com/K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)
- **Primary Focus**: Formatting physical units (SI symbols like $\text{m}\cdot\text{s}^{-1}$, $\text{J}\cdot\text{mol}^{-1}\cdot\text{K}^{-1}$), chemical formulas ($\text{H}_2\text{SO}_4$), IUPAC nomenclature, and physical constants.
- **Upstream License**: **MIT / Apache-2.0 Compatible Permissive Open Source License**
- **License Terms**: Permits free redistribution, adaptation, and integration into new software products without proprietary lock-in.
- **Compliance Status**: Fully compliant. Rules and unit-parsing standards are implemented with direct repository link and credit.

### 3. pandoc-math-docx
- **Repository**: [https://github.com/Kantyc/pandoc-math-docx](https://github.com/Kantyc/pandoc-math-docx)
- **Primary Focus**: Pandoc-compatible markdown math parsing, AST-based inline/block equation extraction, and table-aligned math representations.
- **Upstream License**: **MIT License**
- **License Terms**: Highly permissive open-source license with no commercial or educational restrictions.
- **Compliance Status**: Fully compliant. Pandoc-style delimiter parsing and math environment alignment have been implemented cleanly with complete attribution.

### 4. academic-manuscript-skill
- **Repository**: [https://github.com/kchemorion/academic-manuscript-skill](https://github.com/kchemorion/academic-manuscript-skill)
- **Primary Focus**: Academic manuscript typesetting, Booktabs high-contrast table formatting, IEEE/APA reference standardization, and theorem/lemma block indentation.
- **Upstream License**: **MIT License**
- **License Terms**: Complete freedom to adapt and integrate for any purpose provided the notice remains intact.
- **Compliance Status**: Fully compliant. Publication conventions and Booktabs formatting rules are integrated with full credit.

---

## 🛡️ Copyright & Licensing Analysis Summary

1. **Permissive Compatibility**: All four projects utilize permissive open-source licenses (MIT and Apache 2.0 compatible). None of them use restrictive copyleft licenses (such as GPL v3 or AGPL) that would restrict distribution or force viral license requirements.
2. **Attribution Requirement**: The sole legal obligation under the MIT and Apache 2.0 licenses is to retain the author copyright notice and license text. This obligation is met through:
   - The root `LICENSE` file.
   - This `THIRD_PARTY_LICENSES.md` reference document.
   - Code headers in `/src/skills/` referencing each respective upstream URL.
   - The in-app **"Licenses & Open Source"** tab in the Skills Manager and Footer for live transparency.
3. **Warranty Disclaimer**: As stated in all upstream licenses and our primary `LICENSE`, all software is provided "AS IS", protecting contributors and students from legal liabilities.
