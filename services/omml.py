"""
OMML (Office Math Markup Language) generation module.
Converts LaTeX mathematical expressions into valid Word OMML XML elements
for insertion into python-docx paragraphs.

Supports:
- Fractions (\frac{num}{den})
- Radicals (\sqrt{x}, \sqrt[n]{x})
- Summations (\sum_{i=1}^{n}) with upper & lower limits
- Products (\prod_{i=1}^{n}) with upper & lower limits
- Integrals (\int_a^b, \iint, \iiint, \oint) with limits
- Limits (\lim_{x \to \infty})
- Subscripts (x_i, x_{n+1})
- Superscripts (x^2, e^{-x})
- Sub-Superscripts (\chi^2_\nu, \sigma_1^2)
- Brackets & Parentheses (\left( ... \right), \left[ ... \right])
- Matrices (\begin{bmatrix} ... \end{bmatrix}, \begin{matrix} ... \end{matrix})
- Greek letters, statistical accents (\bar{x}, \hat{p}, \vec{v}, \dot{x})
- Standard probability & statistics notation (P(A), E(X), Var(X), Cov(X,Y), X ~ N(mu, sigma^2))
"""

import re
from xml.sax.saxutils import escape as xml_escape

OMML_NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'

GREEK_SYMBOLS = {
    r'\alpha': 'α', r'\beta': 'β', r'\gamma': 'γ', r'\Gamma': 'Γ',
    r'\delta': 'δ', r'\Delta': 'Δ', r'\epsilon': 'ε', r'\varepsilon': 'ε',
    r'\zeta': 'ζ', r'\eta': 'η', r'\theta': 'θ', r'\Theta': 'Θ',
    r'\iota': 'ι', r'\kappa': 'κ', r'\lambda': 'λ', r'\Lambda': 'Λ',
    r'\mu': 'μ', r'\nu': 'ν', r'\xi': 'ξ', r'\Xi': 'Ξ',
    r'\pi': 'π', r'\Pi': 'Π', r'\rho': 'ρ', r'\sigma': 'σ',
    r'\Sigma': 'Σ', r'\tau': 'τ', r'\upsilon': 'υ', r'\phi': 'φ',
    r'\Phi': 'Φ', r'\chi': 'χ', r'\psi': 'ψ', r'\Psi': 'Ψ',
    r'\omega': 'ω', r'\Omega': 'Ω',
    # Operators & symbols
    r'\times': '×', r'\div': '÷', r'\pm': '±', r'\mp': '∓',
    r'\cdot': '·', r'\circ': '°', r'\bullet': '•',
    r'\leq': '≤', r'\le': '≤', r'\geq': '≥', r'\ge': '≥',
    r'\neq': '≠', r'\ne': '≠', r'\approx': '≈', r'\equiv': '≡',
    r'\propto': '∝', r'\sim': '∼', r'\infty': '∞',
    r'\partial': '∂', r'\nabla': '∇', r'\in': '∈', r'\notin': '∉',
    r'\subset': '⊂', r'\subseteq': '⊆', r'\supset': '⊃', r'\supseteq': '⊇',
    r'\cup': '∪', r'\cap': '∩', r'\forall': '∀', r'\exists': '∃',
    r'\neg': '¬', r'\rightarrow': '→', r'\leftarrow': '←',
    r'\Rightarrow': '⇒', r'\Leftarrow': '⇐', r'\leftrightarrow': '↔',
    r'\Leftrightarrow': '⇔', r'\to': '→'
}


def clean_math_text(text: str) -> str:
    """Replaces LaTeX symbol commands and spacing with readable unicode characters."""
    s = text
    for cmd, sym in GREEK_SYMBOLS.items():
        s = s.replace(cmd + ' ', sym + ' ')
        s = s.replace(cmd, sym)

    s = re.sub(r'\\hat\{([a-zA-Z0-9])\}', r'\1̂', s)
    s = re.sub(r'\\bar\{([a-zA-Z0-9])\}', r'\1̄', s)
    s = re.sub(r'\\vec\{([a-zA-Z0-9])\}', r'\1⃗', s)
    s = re.sub(r'\\tilde\{([a-zA-Z0-9])\}', r'\1̃', s)
    s = re.sub(r'\\dot\{([a-zA-Z0-9])\}', r'\1̇', s)
    s = re.sub(r'\\text\{([^}]+)\}', r'\1', s)
    s = re.sub(r'\\mathbf\{([^}]+)\}', r'\1', s)
    s = re.sub(r'\\mathit\{([^}]+)\}', r'\1', s)
    s = re.sub(r'\\mathrm\{([^}]+)\}', r'\1', s)
    s = s.replace(r'\,', ' ')
    s = s.replace(r'\;', ' ')
    s = s.replace(r'\quad', '   ')
    s = s.replace(r'\qquad', '      ')
    s = s.replace(r'\{', '{').replace(r'\}', '}')
    return s


def parse_bracket_group(latex: str, start_idx: int) -> tuple[str, int]:
    """Extracts content inside matching {...} brackets starting at start_idx."""
    if start_idx >= len(latex) or latex[start_idx] != '{':
        return ('', start_idx)
    depth = 1
    p = start_idx + 1
    inner_start = p
    while p < len(latex) and depth > 0:
        if latex[p] == '{':
            depth += 1
        elif latex[p] == '}':
            depth -= 1
        p += 1
    return (latex[inner_start:p - 1], p)


def parse_script_target(latex: str, start_idx: int) -> tuple[str, int]:
    """Parses single character or braced group following ^ or _."""
    if start_idx >= len(latex):
        return ('', start_idx)
    if latex[start_idx] == '{':
        return parse_bracket_group(latex, start_idx)
    # Check if followed by a command e.g. \nu or \infty
    if latex[start_idx] == '\\':
        m = re.match(r'\\([a-zA-Z]+)', latex[start_idx:])
        if m:
            cmd = m.group(0)
            return (cmd, start_idx + len(cmd))
    return (latex[start_idx], start_idx + 1)


def latex_to_omml_inner(latex: str) -> str:
    """Recursively parses a LaTeX expression into OMML XML fragments."""
    s = latex.strip()
    if not s:
        return ''

    xml_parts: list[str] = []
    i = 0
    n = len(s)

    while i < n:
        # 1. Fractions: \frac{num}{den} or \dfrac{num}{den}
        if s.startswith(r'\frac{', i) or s.startswith(r'\dfrac{', i):
            start_bracket = i + 5 if s.startswith(r'\frac{', i) else i + 6
            num, p_after_num = parse_bracket_group(s, start_bracket)
            if p_after_num < n and s[p_after_num] == '{':
                den, p_after_den = parse_bracket_group(s, p_after_num)
                num_xml = latex_to_omml_inner(num)
                den_xml = latex_to_omml_inner(den)
                xml_parts.append(
                    f'<m:f><m:num><m:e>{num_xml}</m:e></m:num><m:den><m:e>{den_xml}</m:e></m:den></m:f>'
                )
                i = p_after_den
                continue

        # 2. Radicals: \sqrt{...} or \sqrt[n]{...}
        if s.startswith(r'\sqrt', i):
            p = i + 5
            degree = ''
            if p < n and s[p] == '[':
                close_b = s.find(']', p)
                if close_b != -1:
                    degree = s[p + 1:close_b]
                    p = close_b + 1
            if p < n and s[p] == '{':
                inner, p_after_inner = parse_bracket_group(s, p)
                inner_xml = latex_to_omml_inner(inner)
                if degree:
                    deg_xml = latex_to_omml_inner(degree)
                    xml_parts.append(
                        f'<m:rad><m:deg><m:e>{deg_xml}</m:e></m:deg><m:e>{inner_xml}</m:e></m:rad>'
                    )
                else:
                    xml_parts.append(
                        f'<m:rad><m:deg/><m:e>{inner_xml}</m:e></m:rad>'
                    )
                i = p_after_inner
                continue

        # 3. Summations, Products, Integrals: \sum, \prod, \int, \iint, \iiint, \oint
        nary_match = re.match(r'\\(sum|prod|int|iint|iiint|oint)', s[i:])
        if nary_match:
            op_cmd = nary_match.group(1)
            op_sym = {
                'sum': '∑',
                'prod': '∏',
                'int': '∫',
                'iint': '∬',
                'iiint': '∭',
                'oint': '∮'
            }.get(op_cmd, '∑')
            p = i + len(nary_match.group(0))

            sub_val = ''
            sup_val = ''
            # check for _{...} and ^{...} in either order
            for _ in range(2):
                if p < n and s[p] == '_':
                    sub_val, p = parse_script_target(s, p + 1)
                elif p < n and s[p] == '^':
                    sup_val, p = parse_script_target(s, p + 1)

            sub_xml = latex_to_omml_inner(sub_val) if sub_val else ''
            sup_xml = latex_to_omml_inner(sup_val) if sup_val else ''

            xml_parts.append(
                f'<m:nary>'
                f'<m:naryPr><m:chr m:val="{op_sym}"/><m:limLoc m:val="undOvr"/></m:naryPr>'
                f'<m:sub><m:e>{sub_xml}</m:e></m:sub>'
                f'<m:sup><m:e>{sup_xml}</m:e></m:sup>'
                f'<m:e></m:e>'
                f'</m:nary>'
            )
            i = p
            continue

        # 4. Limits: \lim_{...}
        if s.startswith(r'\lim', i):
            p = i + 4
            sub_val = ''
            if p < n and s[p] == '_':
                sub_val, p = parse_script_target(s, p + 1)
            sub_xml = latex_to_omml_inner(sub_val) if sub_val else ''
            xml_parts.append(
                f'<m:limLow>'
                f'<m:e><m:r><m:t>lim</m:t></m:r></m:e>'
                f'<m:lim><m:e>{sub_xml}</m:e></m:lim>'
                f'</m:limLow>'
            )
            i = p
            continue

        # 5. Matrices: \begin{bmatrix} ... \end{bmatrix} or \begin{matrix} ... \end{matrix}
        matrix_match = re.match(r'\\begin\{(bmatrix|matrix|pmatrix)\}([\s\S]*?)\\end\{\1\}', s[i:])
        if matrix_match:
            mat_type = matrix_match.group(1)
            mat_body = matrix_match.group(2).strip()
            rows = [r.strip() for r in mat_body.split(r'\\') if r.strip()]

            rows_xml = []
            for row in rows:
                cols = [c.strip() for c in row.split('&')]
                cols_xml = []
                for col in cols:
                    cell_xml = latex_to_omml_inner(col)
                    cols_xml.append(f'<m:e>{cell_xml}</m:e>')
                rows_xml.append(f'<m:mr>{"".join(cols_xml)}</m:mr>')

            matrix_xml = f'<m:m>{"".join(rows_xml)}</m:m>'

            # Add brackets for bmatrix / pmatrix
            if mat_type == 'bmatrix':
                xml_parts.append(
                    f'<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/><m:grow/></m:dPr><m:e>{matrix_xml}</m:e></m:d>'
                )
            elif mat_type == 'pmatrix':
                xml_parts.append(
                    f'<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/><m:grow/></m:dPr><m:e>{matrix_xml}</m:e></m:d>'
                )
            else:
                xml_parts.append(matrix_xml)

            i += len(matrix_match.group(0))
            continue

        # 6. Delimiters: \left( ... \right) or \left[ ... \right]
        delim_match = re.match(r'\\left([\(\[\{])([\s\S]*?)\\right([\)\]\}])', s[i:])
        if delim_match:
            beg_chr = delim_match.group(1)
            inner_content = delim_match.group(2)
            end_chr = delim_match.group(3)
            inner_xml = latex_to_omml_inner(inner_content)
            xml_parts.append(
                f'<m:d><m:dPr><m:begChr m:val="{beg_chr}"/><m:endChr m:val="{end_chr}"/><m:grow/></m:dPr><m:e>{inner_xml}</m:e></m:d>'
            )
            i += len(delim_match.group(0))
            continue

        # 7. Subscripts & Superscripts on a base token:
        # e.g., \chi^2_\nu, \sigma_1^2, x_i, e^{-x}, (x - \mu)^2
        subsup_match = re.match(r'(\\[a-zA-Z]+|[a-zA-Z0-9]|\([^\(\)]+\)|\[[^\[\]]+\])([\_\^])', s[i:])
        if subsup_match:
            base_raw = subsup_match.group(1)
            first_char = subsup_match.group(2)
            p = i + len(subsup_match.group(0)) - 1  # points to first _ or ^

            first_is_sub = (first_char == '_')
            first_val, p = parse_script_target(s, p + 1)

            second_val = ''
            if p < n and s[p] in ('_', '^') and s[p] != first_char:
                second_val, p = parse_script_target(s, p + 1)

            sub_val = first_val if first_is_sub else second_val
            sup_val = second_val if first_is_sub else first_val

            base_clean = clean_math_text(base_raw)
            base_xml = f'<m:r><m:t>{xml_escape(base_clean)}</m:t></m:r>'
            sub_xml = latex_to_omml_inner(sub_val) if sub_val else ''
            sup_xml = latex_to_omml_inner(sup_val) if sup_val else ''

            if sub_val and sup_val:
                xml_parts.append(
                    f'<m:sSubSup>'
                    f'<m:e>{base_xml}</m:e>'
                    f'<m:sub><m:e>{sub_xml}</m:e></m:sub>'
                    f'<m:sup><m:e>{sup_xml}</m:e></m:sup>'
                    f'</m:sSubSup>'
                )
            elif sub_val:
                xml_parts.append(
                    f'<m:sSub>'
                    f'<m:e>{base_xml}</m:e>'
                    f'<m:sub><m:e>{sub_xml}</m:e></m:sub>'
                    f'</m:sSub>'
                )
            elif sup_val:
                xml_parts.append(
                    f'<m:sSup>'
                    f'<m:e>{base_xml}</m:e>'
                    f'<m:sup><m:e>{sup_xml}</m:e></m:sup>'
                    f'</m:sSup>'
                )
            i = p
            continue

        # 8. Regular text run up to next structured construct
        # Look ahead for special commands or delimiters
        next_special = re.search(r'\\(frac|dfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|left|begin)|[\_\^]', s[i + 1:])
        end_idx = i + 1 + next_special.start() if next_special else n
        text_chunk = s[i:end_idx]

        if text_chunk:
            cleaned = clean_math_text(text_chunk)
            xml_parts.append(f'<m:r><m:t>{xml_escape(cleaned)}</m:t></m:r>')
        i = end_idx

    return ''.join(xml_parts)


def latex_to_omml(latex: str, display: bool = False) -> str:
    """
    Main entry point: converts a LaTeX string into an <m:oMath> or <m:oMathPara> XML element.
    Returns clean XML string ready for parse_xml().
    """
    cleaned = latex.strip()
    # Strip wrapping $ signs if present
    if cleaned.startswith('$$') and cleaned.endswith('$$') and len(cleaned) >= 4:
        cleaned = cleaned[2:-2].strip()
        display = True
    elif cleaned.startswith('$') and cleaned.endswith('$') and len(cleaned) >= 2:
        cleaned = cleaned[1:-1].strip()

    inner_xml = latex_to_omml_inner(cleaned)
    if not inner_xml:
        inner_xml = f'<m:r><m:t>{xml_escape(clean_math_text(cleaned))}</m:t></m:r>'

    if display:
        return (
            f'<m:oMathPara {OMML_NS}>'
            f'<m:oMath>{inner_xml}</m:oMath>'
            f'</m:oMathPara>'
        )
    else:
        return (
            f'<m:oMath {OMML_NS}>'
            f'{inner_xml}'
            f'</m:oMath>'
        )
