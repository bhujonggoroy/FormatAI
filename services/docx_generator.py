"""
Document generation service utilizing python-docx with native OMML mathematical equation injection.
Ensures:
- Native Word equations via OMML (no images, no flat unicode degradation)
- Professional typography (Times New Roman / Calibri / Arial)
- Proper heading hierarchy (Title, Heading 1, Heading 2, Heading 3)
- Tables with styled header rows and borders
- Bulleted and numbered lists with clean indentation
- Blockquotes / Callout callouts
"""

import io
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from services.omml import latex_to_omml, clean_math_text
from services.math_parser import clean_notebooklm_tree_artifacts, repair_crude_math_patterns


COLOR_PALETTES = {
    '#1A365D': RGBColor(0x1A, 0x36, 0x5D), # Navy
    '#2D3748': RGBColor(0x2D, 0x37, 0x48), # Slate Charcoal
    '#22543D': RGBColor(0x22, 0x54, 0x3D), # Forest Emerald
    '#44337A': RGBColor(0x44, 0x33, 0x7A), # Imperial Plum
}


def hex_to_rgb(hex_str: str) -> RGBColor:
    hex_clean = hex_str.lstrip('#')
    if len(hex_clean) != 6:
        return RGBColor(0x1A, 0x36, 0x5D)
    return RGBColor(int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16))


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets padding for a table cell in twips."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_shading(cell, color_hex: str):
    """Sets cell background color."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)


def parse_inline_elements(paragraph, text: str, font_name: str, font_size_pt: float, base_color: RGBColor):
    """
    Parses inline markdown:
    - Inline math $...$ -> injects native OMML <m:oMath>
    - Bold **...**
    - Italic *...*
    - Code `...`
    - Plain text
    """
    # Regex split on inline math ($...$), bold (**...**), italic (*...*), or code (`...`)
    tokens = re.split(r'(\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)', text)

    for token in tokens:
        if not token:
            continue

        # 1. Inline Math: $...$
        if token.startswith('$') and token.endswith('$') and len(token) >= 3:
            math_expr = token[1:-1].strip()
            try:
                omml_str = latex_to_omml(math_expr, display=False)
                omml_elem = parse_xml(omml_str)
                paragraph._p.append(omml_elem)
            except Exception:
                # Fallback run
                run = paragraph.add_run(clean_math_text(math_expr))
                run.font.name = "Cambria Math"
                run.font.size = Pt(font_size_pt)
                run.font.color.rgb = RGBColor(0x1A, 0x36, 0x5D)
            continue

        # 2. Bold: **...**
        if token.startswith('**') and token.endswith('**') and len(token) >= 4:
            inner = token[2:-2]
            run = paragraph.add_run(inner)
            run.bold = True
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
            run.font.color.rgb = base_color
            continue

        # 3. Italic: *...*
        if token.startswith('*') and token.endswith('*') and len(token) >= 2:
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.italic = True
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
            run.font.color.rgb = base_color
            continue

        # 4. Code: `...`
        if token.startswith('`') and token.endswith('`') and len(token) >= 2:
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = "Consolas"
            run.font.size = Pt(font_size_pt - 0.5)
            run.font.color.rgb = RGBColor(0xC5, 0x30, 0x30)
            continue

        # 5. Plain text
        run = paragraph.add_run(token)
        run.font.name = font_name
        run.font.size = Pt(font_size_pt)
        run.font.color.rgb = base_color


def build_docx_from_notes(
    markdown_text: str,
    title: str = "NotebookLM Notes",
    font_name: str = "Times New Roman",
    accent_hex: str = "#1A365D"
) -> io.BytesIO:
    """
    Builds a professional Word document (.docx) from markdown notes,
    with native OMML equations, custom fonts, and styled headers.
    """
    doc = docx.Document()

    # Configure 1-inch standard margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    accent_color = hex_to_rgb(accent_hex)
    body_color = RGBColor(0x2D, 0x37, 0x48) # Dark neutral
    subhead_color = RGBColor(0x2B, 0x6C, 0xB0) # Steel blue

    # Pre-clean raw text
    cleaned = clean_notebooklm_tree_artifacts(markdown_text)
    cleaned = repair_crude_math_patterns(cleaned)

    # Add Document Title if provided
    if title and title.strip():
        title_p = doc.add_paragraph()
        title_p.paragraph_format.space_before = Pt(0)
        title_p.paragraph_format.space_after = Pt(14)
        run_t = title_p.add_run(title.strip())
        run_t.font.name = font_name
        run_t.font.size = Pt(24)
        run_t.bold = True
        run_t.font.color.rgb = accent_color

    lines = cleaned.split('\n')
    i = 0
    total_lines = len(lines)

    in_code_block = False
    code_lines = []

    while i < total_lines:
        line = lines[i]
        stripped = line.strip()

        # Handle Code blocks
        if stripped.startswith('```'):
            if in_code_block:
                code_text = '\n'.join(code_lines)
                table = doc.add_table(rows=1, cols=1)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell = table.cell(0, 0)
                set_cell_shading(cell, "F8FAFC")
                set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
                cp = cell.paragraphs[0]
                cp.paragraph_format.space_before = Pt(4)
                cp.paragraph_format.space_after = Pt(4)
                c_run = cp.add_run(code_text)
                c_run.font.name = "Consolas"
                c_run.font.size = Pt(9.5)
                c_run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

                spacer = doc.add_paragraph()
                spacer.paragraph_format.space_after = Pt(6)

                in_code_block = False
                code_lines = []
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        # 1. Display Equations: $$ ... $$ or \[ ... \]
        if stripped.startswith('$$'):
            math_expr = ''
            if stripped.endswith('$$') and len(stripped) >= 4:
                math_expr = stripped[2:-2].strip()
                i += 1
            else:
                # Multi-line $$ equation block
                block_lines = [stripped[2:].strip()]
                i += 1
                while i < total_lines:
                    nxt = lines[i].strip()
                    if nxt.endswith('$$'):
                        end_str = nxt[:-2].strip()
                        if end_str:
                            block_lines.append(end_str)
                        i += 1
                        break
                    block_lines.append(lines[i])
                    i += 1
                math_expr = ' '.join(block_lines).strip()

            if math_expr:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(8)
                try:
                    omml_xml = latex_to_omml(math_expr, display=True)
                    p._p.append(parse_xml(omml_xml))
                except Exception:
                    run = p.add_run(clean_math_text(math_expr))
                    run.font.name = "Cambria Math"
                    run.font.size = Pt(12)
                    run.font.color.rgb = RGBColor(0x1A, 0x36, 0x5D)
            continue

        if stripped.startswith(r'\[') and stripped.endswith(r'\]') and len(stripped) >= 4:
            math_expr = stripped[2:-2].strip()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(8)
            try:
                omml_xml = latex_to_omml(math_expr, display=True)
                p._p.append(parse_xml(omml_xml))
            except Exception:
                run = p.add_run(clean_math_text(math_expr))
                run.font.name = "Cambria Math"
                run.font.size = Pt(12)
                run.font.color.rgb = RGBColor(0x1A, 0x36, 0x5D)
            i += 1
            continue

        # 2. Markdown Tables (| ... |)
        if stripped.startswith('|') and stripped.endswith('|') and i + 1 < total_lines and re.match(r'^\|[\s\:\-\|]+\|$', lines[i + 1].strip()):
            table_lines = []
            while i < total_lines and lines[i].strip().startswith('|') and lines[i].strip().endswith('|'):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 3:
                # Parse header, separator, and data rows
                headers = [c.strip() for c in table_lines[0].strip('|').split('|')]
                data_rows = [
                    [c.strip() for c in r.strip('|').split('|')]
                    for r in table_lines[2:]
                ]

                num_cols = len(headers)
                t = doc.add_table(rows=len(data_rows) + 1, cols=num_cols)
                t.alignment = WD_TABLE_ALIGNMENT.CENTER
                t.autofit = True

                # Style Header Row
                for c_idx, h_text in enumerate(headers):
                    cell = t.cell(0, c_idx)
                    set_cell_shading(cell, "F1F5F9")
                    set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
                    cp = cell.paragraphs[0]
                    cp.paragraph_format.space_before = Pt(2)
                    cp.paragraph_format.space_after = Pt(2)
                    parse_inline_elements(cp, h_text, font_name, 10.5, RGBColor(0x0F, 0x17, 0x2A))
                    for run in cp.runs:
                        run.bold = True

                # Style Data Rows
                for r_idx, row_data in enumerate(data_rows):
                    for c_idx in range(num_cols):
                        val = row_data[c_idx] if c_idx < len(row_data) else ""
                        cell = t.cell(r_idx + 1, c_idx)
                        set_cell_margins(cell, top=60, bottom=60, left=120, right=120)
                        cp = cell.paragraphs[0]
                        cp.paragraph_format.space_before = Pt(2)
                        cp.paragraph_format.space_after = Pt(2)
                        parse_inline_elements(cp, val, font_name, 10.0, body_color)

                spacer = doc.add_paragraph()
                spacer.paragraph_format.space_after = Pt(8)
                continue

        # 3. Headings
        if stripped.startswith('# '):
            h_text = stripped[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            parse_inline_elements(p, h_text, font_name, 18, accent_color)
            for r in p.runs:
                r.bold = True
            i += 1
            continue

        if stripped.startswith('## '):
            h_text = stripped[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(13)
            p.paragraph_format.space_after = Pt(5)
            p.paragraph_format.keep_with_next = True
            parse_inline_elements(p, h_text, font_name, 14, subhead_color)
            for r in p.runs:
                r.bold = True
            i += 1
            continue

        if stripped.startswith('### '):
            h_text = stripped[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            parse_inline_elements(p, h_text, font_name, 12, RGBColor(0x33, 0x41, 0x55))
            for r in p.runs:
                r.bold = True
            i += 1
            continue

        # 4. Bullet Lists (- ... or * ...)
        if re.match(r'^\s*[-*]\s+', line):
            indent_spaces = len(re.match(r'^(\s*)', line).group(1))
            bullet_level = min(3, indent_spaces // 2)
            item_text = re.sub(r'^\s*[-*]\s+', '', line).strip()

            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.left_indent = Inches(0.25 * (bullet_level + 1))
            parse_inline_elements(p, item_text, font_name, 11, body_color)
            i += 1
            continue

        # 5. Numbered Lists (1. ...)
        m_num = re.match(r'^(\d+\.)\s+(.*)', stripped)
        if m_num:
            prefix = m_num.group(1)
            item_text = m_num.group(2).strip()

            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.left_indent = Inches(0.25)

            p_run = p.add_run(prefix + " ")
            p_run.bold = True
            p_run.font.name = font_name
            p_run.font.size = Pt(11)
            p_run.font.color.rgb = subhead_color

            parse_inline_elements(p, item_text, font_name, 11, body_color)
            i += 1
            continue

        # 6. Blockquote / Callout (> ...)
        if stripped.startswith('> '):
            quote_text = stripped[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            parse_inline_elements(p, quote_text, font_name, 10.5, RGBColor(0x1E, 0x29, 0x3B))
            i += 1
            continue

        # 7. Standard Paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        parse_inline_elements(p, stripped, font_name, 11, body_color)
        i += 1

    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return file_stream
