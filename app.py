import os
import re
import io
from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import docx
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import google.generativeai as genai
from services.docx_generator import build_docx_from_notes

# Load environment variables from .env
load_dotenv()

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

UNICODE_MATH_REPLACEMENTS = {
    # Greek letters
    r'\alpha': 'α', r'\beta': 'β', r'\gamma': 'γ', r'\Gamma': 'Γ',
    r'\delta': 'δ', r'\Delta': 'Δ', r'\epsilon': 'ε', r'\varepsilon': 'ε',
    r'\zeta': 'ζ', r'\eta': 'η', r'\theta': 'θ', r'\Theta': 'Θ',
    r'\iota': 'ι', r'\kappa': 'κ', r'\lambda': 'λ', r'\Lambda': 'Λ',
    r'\mu': 'μ', r'\nu': 'ν', r'\xi': 'ξ', r'\Xi': 'Ξ',
    r'\pi': 'π', r'\Pi': 'Π', r'\rho': 'ρ', r'\sigma': 'σ',
    r'\Sigma': 'Σ', r'\tau': 'τ', r'\upsilon': 'υ', r'\phi': 'φ',
    r'\Phi': 'Φ', r'\chi': 'χ', r'\psi': 'ψ', r'\Psi': 'Ψ',
    r'\omega': 'ω', r'\Omega': 'Ω',
    
    # Operators and Symbols
    r'\times': '×', r'\div': '÷', r'\pm': '±', r'\mp': '∓',
    r'\cdot': '·', r'\circ': '°', r'\bullet': '•',
    r'\leq': '≤', r'\le': '≤', r'\geq': '≥', r'\ge': '≥',
    r'\neq': '≠', r'\ne': '≠', r'\approx': '≈', r'\equiv': '≡',
    r'\propto': '∝', r'\sim': '∼',
    r'\infty': '∞', r'\partial': '∂', r'\nabla': '∇',
    r'\sum': '∑', r'\prod': '∏', r'\int': '∫', r'\iint': '∬', r'\iiint': '∭',
    r'\oint': '∮', r'\sqrt': '√',
    r'\in': '∈', r'\notin': '∉', r'\subset': '⊂', r'\subseteq': '⊆',
    r'\supset': '⊃', r'\supseteq': '⊇', r'\cup': '∪', r'\cap': '∩',
    r'\forall': '∀', r'\exists': '∃', r'\neg': '¬',
    r'\rightarrow': '→', r'\leftarrow': '←', r'\Rightarrow': '⇒', r'\Leftarrow': '⇐',
    r'\leftrightarrow': '↔', r'\Leftrightarrow': '⇔',
}

SUPERSCRIPTS = str.maketrans("0123456789+-=()nixyzt", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸᶻᵗ")
SUBSCRIPTS = str.maketrans("0123456789+-=()aehijklmnoprstuvx", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ")

def clean_notebooklm_tree_artifacts(text: str) -> str:
    """Strips tree-drawing pipes and branches copied from NotebookLM and converts into clean markdown."""
    if not text:
        return text
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Check if line contains tree branch artifacts
        if re.search(r'([│|├└┌┬─\+\-]{2,}|[│|]\s*├──|[│|]\s*└──|[│|]\s*├─|[│|]\s*└─)', line):
            # Calculate depth based on branch markers
            level = 1
            if re.search(r'([│|]\s*){2,}', line):
                level = 2
            # Strip branch drawings
            content = re.sub(r'^[│|\s\+\-]*[├└┌┬][─\-\s]*', '', line)
            content = re.sub(r'^[│|\s]{2,}', '', content).strip()
            if not content:
                continue
            # If section header, format with Markdown heading or bullet
            if re.match(r'^\d+(\.\d+)*\s+[A-Za-z]', content):
                cleaned_lines.append(f"### {content}")
            else:
                indent = "  " * level
                cleaned_lines.append(f"{indent}- {content}")
        else:
            cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)


def standardize_math_to_latex(text: str) -> str:
    """Standardizes crude pseudo-math into academic LaTeX."""
    if not text:
        return text
    # Convert √[expr / expr] into \sqrt{\frac{num}{den}}
    text = re.sub(
        r'√\[\s*([^\/\]]+)\s*\/\s*([^\]]+)\s*\]',
        r'\\sqrt{\\frac{\1}{\2}}',
        text
    )
    # Convert √[...] into \sqrt{...}
    text = re.sub(r'√\[([^\]]+)\]', r'\\sqrt{\1}', text)
    # Convert √(expr) into \sqrt{expr}
    text = re.sub(r'√\(([^)]+)\)', r'\\sqrt{\1}', text)
    # Convert X̄ or X_bar into \bar{X}
    text = re.sub(r'([A-Za-z])̄', r'\\bar{\1}', text)
    # Convert p̂ or p_hat into \hat{p}
    text = re.sub(r'([A-Za-z])̂', r'\\hat{\1}', text)

    # Normalize terms with math: **Parameter ($\theta$):** -> **Parameter** ($\theta$):
    text = re.sub(r'\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\s*:\*\*', r'**\1** ($\2):', text)
    text = re.sub(r'\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\*\*', r'**\1** ($\2)', text)
    text = re.sub(r'\bParameter\s*\(\s*θ\s*\)', r'Parameter ($\\theta$)', text)
    text = re.sub(r'\bParameter\s*\(\s*\\?theta\s*\)', r'Parameter ($\\theta$)', text)
    text = re.sub(r'\bStatistic\s*\(\s*T\s*\)', r'Statistic ($T$)', text)

    # Auto-wrap un-delimited Greek letters, accents, and square variables outside existing $ blocks
    parts = re.split(r'(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)', text)
    result_parts = []
    for idx, part in enumerate(parts):
        if idx % 2 == 1:
            result_parts.append(part)
        else:
            p = part
            p = re.sub(
                r'\\(theta|mu|sigma|alpha|beta|gamma|delta|epsilon|zeta|eta|iota|kappa|lambda|nu|xi|pi|rho|tau|upsilon|phi|chi|psi|omega|Theta|Sigma|Delta|Lambda|Phi|Psi|Omega)(?:\^2|_[0-9]\^2|_[0-9])?\b',
                r'$\g<0>$',
                p
            )
            p = re.sub(r'\\(bar|hat|tilde|vec)\{([^{}]+)\}', r'$\g<0>$', p)
            p = re.sub(r'\b([Ss])\^2\b', r'$\g<0>$', p)
            p = re.sub(r'\s+([,.;:?)\]])', r'\1', p)
            result_parts.append(p)

    return ''.join(result_parts)


def sanitize_math_to_unicode(text: str) -> str:
    """Replaces raw LaTeX commands and sub/superscripts with clean Unicode representation."""
    if not text:
        return text

    # Replace basic LaTeX symbols
    for latex_sym, unicode_sym in UNICODE_MATH_REPLACEMENTS.items():
        text = text.replace(latex_sym + ' ', unicode_sym + ' ')
        text = text.replace(latex_sym, unicode_sym)

    # Fractions: \frac{num}{den} -> (num)/(den)
    text = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'(\1)/(\2)', text)
    
    # Square root: \sqrt{x} -> √(x)
    text = re.sub(r'\\sqrt\{([^{}]+)\}', r'√(\1)', text)
    text = re.sub(r'\\sqrt\[([^{}]+)\]\{([^{}]+)\}', r'^\1√(\2)', text)

    # Superscripts: x^{2} -> x² or x^2
    def replace_super(match):
        val = match.group(1)
        trans = val.translate(SUPERSCRIPTS)
        return trans if trans != val else f"^{val}"
    
    text = re.sub(r'\^\{([a-zA-Z0-9\+\-\=\(\)]+)\}', replace_super, text)
    text = re.sub(r'\^([0-9])', lambda m: m.group(1).translate(SUPERSCRIPTS), text)

    # Subscripts: x_{1} -> x₁
    def replace_sub(match):
        val = match.group(1)
        trans = val.translate(SUBSCRIPTS)
        return trans if trans != val else f"_{val}"
    
    text = re.sub(r'\_\{([a-zA-Z0-9\+\-\=\(\)]+)\}', replace_sub, text)
    text = re.sub(r'\_([0-9])', lambda m: m.group(1).translate(SUBSCRIPTS), text)

    # Clean leftover dollar signs from inline / display math
    text = re.sub(r'\$\$([^\$]+)\$\$', r'\1', text)
    text = re.sub(r'\$([^\$]+)\$', r'\1', text)
    
    # Clean redundant braces
    text = re.sub(r'\\text\{([^{}]+)\}', r'\1', text)
    text = re.sub(r'\\mathbf\{([^{}]+)\}', r'\1', text)
    text = re.sub(r'\\mathit\{([^{}]+)\}', r'\1', text)

    return text


def clean_notes_with_gemini(raw_text: str) -> str:
    """Uses Gemini API to fix LaTeX, format equations into clean academic LaTeX and Unicode, and structure notes into Markdown."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Please set the GEMINI_API_KEY environment variable.")

    # Pre-clean tree artifacts and normalize crude math before AI
    pre_cleaned = standardize_math_to_latex(clean_notebooklm_tree_artifacts(raw_text))

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    try:
        model = genai.GenerativeModel(model_name)
    except Exception:
        model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = """You are an expert technical editor, academic formatter, and mathematical typesetter.
Your task is to take messy study notes copied from Google NotebookLM (which often contain tree-drawing pipes, broken LaTeX, unformatted math symbols, and truncated equations) and transform them into beautifully organized, publication-ready study notes formatted with standard Markdown and proper mathematical equation standards.

CRITICAL FORMATTING & EQUATION STANDARDS:
1. TREE ARTIFACT ELIMINATION:
   - Completely strip all tree-drawing characters: |, │, ├──, └──, ├─, └─, +, `---`.
   - Never output pipe vertical bars or branch ASCII symbols.
   - Transform outline structures into clean standard Markdown:
     - Main module: # Main Title
     - Sections (e.g. 2. Standard Errors, 2.3 Sample Size Dynamics): ## or ### Section Name
     - Bullet items: - **Item Name:** Equation / explanation
2. MATHEMATICAL RIGOR & PROPER EQUATION FORMAT:
   - Convert all pseudo-math and broken notation into rigorous, standard LaTeX equations enclosed in $...$ for inline or $$...$$ for standalone display equations.
   - When a defined term includes a math symbol in parentheses, format cleanly:
     - Write: - **Parameter** (\\theta): or - **Statistic** ($T$):
     - Never trap math inside bold asterisks without dollar signs.
   - All mathematical variables, Greek symbols, and parameters MUST be enclosed in $...$:
     - e.g., $\\theta$, $T$, $\\mu$, $\\sigma^2$, $p$, $\\bar{X}$, $S^2$, $\\hat{p}$, $\\alpha$, $\\beta$.
   - For example:
     - SE(p̂) = √[p(1 - p) / n] MUST become: $SE(\\hat{p}) = \\sqrt{\\frac{p(1 - p)}{n}}$
     - SE(X̄₁ - X̄₂) = √[(σ₁² / n₁) + (σ₂² / n₂)] MUST become: $SE(\\bar{X}_1 - \\bar{X}_2) = \\sqrt{\\frac{\\sigma_1^2}{n_1} + \\frac{\\sigma_2^2}{n_2}}$
     - SE ∝ 1 / √n MUST become: $SE \\propto \\frac{1}{\\sqrt{n}}$
     - Multiplier: √[(N - n) / (N - 1)] MUST become: **Multiplier:** $\\sqrt{\\frac{N - n}{N - 1}}$
   - Always use proper LaTeX fractions (\\frac{num}{den}), radicals (\\sqrt{...}), hats (\\hat{...}), bars (\\bar{...}), and subscripts/superscripts.
   - Never output raw bracketed roots like √[...] or crude slashes in equations.
3. CONTENT PRESERVATION:
   - Preserve ALL original information, explanations, facts, concepts, theorems, examples, and parenthetical notes. Do NOT summarize or omit anything.
4. OUTPUT FORMAT:
   - Output ONLY the cleaned Markdown text.
   - Do NOT include conversational intros.
   - Do NOT wrap the entire output in a top-level ```markdown fence. Return raw Markdown directly.

RAW NOTEBOOKLM NOTES:
""" + pre_cleaned

    response = model.generate_content(prompt)
    if not response or not response.text:
        raise RuntimeError("Empty response received from Gemini API.")

    cleaned_text = response.text.strip()
    # Strip wrapping markdown fences if Gemini added them
    if cleaned_text.startswith("```markdown"):
        cleaned_text = cleaned_text[11:].strip()
    elif cleaned_text.startswith("```"):
        cleaned_text = cleaned_text[3:].strip()
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3].strip()

    # Post-clean tree artifacts and normalize math
    return standardize_math_to_latex(clean_notebooklm_tree_artifacts(cleaned_text))


def add_formatted_runs(paragraph, text: str, font_name: str = "Times New Roman", base_size: int = 11, base_color: RGBColor = None, parent_bold: bool = False, parent_italic: bool = False):
    """Parses inline bold (**text**), italic (*text*), code (`text`), and math ($math$) and adds runs."""
    pattern = re.compile(r'(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)')
    tokens = pattern.split(text)

    for token in tokens:
        if not token:
            continue

        if token.startswith('$') and token.endswith('$') and len(token) >= 3:
            # Mathematical expression - render with Cambria Math
            math_content = token[1:-1]
            unicode_math = sanitize_math_to_unicode(math_content)
            run = paragraph.add_run()
            run.font.name = "Cambria Math"
            run.font.size = Pt(base_size)
            run.font.bold = parent_bold
            run.font.italic = parent_italic
            run.text = unicode_math
        elif token.startswith('**') and token.endswith('**') and len(token) >= 4:
            inner = token[2:-2]
            if '$' in inner or '*' in inner or '`' in inner:
                add_formatted_runs(paragraph, inner, font_name, base_size, base_color, parent_bold=True, parent_italic=parent_italic)
            else:
                run = paragraph.add_run()
                run.font.name = font_name
                run.font.size = Pt(base_size)
                if base_color:
                    run.font.color.rgb = base_color
                run.text = inner
                run.bold = True
                run.italic = parent_italic
        elif token.startswith('*') and token.endswith('*') and len(token) >= 2:
            inner = token[1:-1]
            if '$' in inner or '**' in inner or '`' in inner:
                add_formatted_runs(paragraph, inner, font_name, base_size, base_color, parent_bold=parent_bold, parent_italic=True)
            else:
                run = paragraph.add_run()
                run.font.name = font_name
                run.font.size = Pt(base_size)
                if base_color:
                    run.font.color.rgb = base_color
                run.text = inner
                run.bold = parent_bold
                run.italic = True
        elif token.startswith('`') and token.endswith('`') and len(token) >= 2:
            run = paragraph.add_run()
            run.font.name = "Consolas"
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(180, 40, 40)
            run.text = token[1:-1]
        else:
            run = paragraph.add_run()
            run.font.name = font_name
            run.font.size = Pt(base_size)
            if base_color:
                run.font.color.rgb = base_color
            run.text = token
            run.bold = parent_bold
            run.italic = parent_italic


def create_docx_from_markdown(markdown_text: str, title: str = "NotebookLM Notes", font_family: str = "Times New Roman") -> io.BytesIO:
    """Builds a beautifully styled Word document (.docx) using python-docx."""
    doc = docx.Document()

    # Configure page margins (1 inch all around)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Color Palette: Academic Navy
    NAVY = RGBColor(26, 54, 93)        # #1A365D
    STEEL_BLUE = RGBColor(43, 108, 176) # #2B6CB0
    DARK_GRAY = RGBColor(45, 55, 72)    # #2D3748
    MUTED_GRAY = RGBColor(113, 128, 150) # #718096

    lines = markdown_text.split('\n')
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):
        line = lines[i].rstrip()
        
        # Code block handling
        if line.startswith('```'):
            if in_code_block:
                # Flush code block
                code_text = '\n'.join(code_lines)
                table = doc.add_table(rows=1, cols=1)
                table.autofit = False
                cell = table.cell(0, 0)
                # Light gray background for code cell
                shading_xml = parse_xml(r'<w:shd {} w:fill="F7FAFC"/>'.format(nsdecls('w')))
                cell._tc.get_or_add_tcPr().append(shading_xml)
                
                cp = cell.paragraphs[0]
                cp.paragraph_format.space_before = Pt(4)
                cp.paragraph_format.space_after = Pt(4)
                crun = cp.add_run(code_text)
                crun.font.name = "Consolas"
                crun.font.size = Pt(9.5)
                crun.font.color.rgb = RGBColor(44, 62, 80)
                
                doc.add_paragraph().paragraph_format.space_after = Pt(4)
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        stripped = line.strip()

        # Blank line
        if not stripped:
            i += 1
            continue

        # Heading 1
        elif stripped.startswith('# '):
            h_text = stripped[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            add_formatted_runs(p, f"**{h_text}**", font_name=font_family, base_size=20, base_color=NAVY)

        # Heading 2
        elif stripped.startswith('## '):
            h_text = stripped[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            add_formatted_runs(p, f"**{h_text}**", font_name=font_family, base_size=15, base_color=STEEL_BLUE)

        # Heading 3
        elif stripped.startswith('### '):
            h_text = stripped[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            add_formatted_runs(p, f"**{h_text}**", font_name=font_family, base_size=12.5, base_color=DARK_GRAY)

        # Display Equation Block: $$ ... $$
        elif stripped.startswith('$$'):
            math_lines = []
            if stripped.endswith('$$') and len(stripped) >= 4:
                math_lines.append(stripped[2:-2].strip())
            else:
                first = stripped[2:].strip()
                if first:
                    math_lines.append(first)
                i += 1
                while i < len(lines):
                    next_trimmed = lines[i].strip()
                    if next_trimmed.endswith('$$'):
                        end_part = next_trimmed[:-2].strip()
                        if end_part:
                            math_lines.append(end_part)
                        break
                    math_lines.append(lines[i])
                    i += 1
            full_math = " ".join(math_lines).strip()
            if full_math:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(4)
                add_formatted_runs(p, f"${full_math}$", font_name="Cambria Math", base_size=11, base_color=RGBColor(26, 54, 93))

        # Bullet List Item
        elif stripped.startswith(('- ', '* ')):
            item_text = stripped[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            add_formatted_runs(p, item_text, font_name=font_family, base_size=11, base_color=DARK_GRAY)

        # Numbered List Item
        elif re.match(r'^\d+\.\s+', stripped):
            num_match = re.match(r'^\d+\.\s+', stripped)
            item_text = stripped[num_match.end():].strip()
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            add_formatted_runs(p, item_text, font_name=font_family, base_size=11, base_color=DARK_GRAY)

        # Blockquote or Formula Callout (as indented paragraph, NOT a table)
        elif stripped.startswith('> '):
            quote_text = stripped[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            add_formatted_runs(p, quote_text, font_name=font_family, base_size=10.5, base_color=RGBColor(44, 82, 130))

        # Standard Paragraph
        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(5)
            p.paragraph_format.line_spacing = 1.2
            add_formatted_runs(p, stripped, font_name=font_family, base_size=11, base_color=DARK_GRAY)

        i += 1

    # Save to memory buffer
    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return file_stream


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "has_gemini_key": bool(os.getenv("GEMINI_API_KEY")),
        "service": "NotebookLM to DOCX Converter"
    })


@app.route('/convert', methods=['POST'])
@app.route('/api/convert', methods=['POST'])
def convert_endpoint():
    """Main conversion endpoint."""
    try:
        data = request.get_json(silent=True)
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body."}), 400

        raw_text = data.get('text', '').strip()
        if not raw_text:
            return jsonify({"error": "Please provide notes text to convert."}), 400

        doc_title = data.get('title', 'NotebookLM Notes').strip() or 'NotebookLM Notes'
        font_family = data.get('font', 'Times New Roman').strip() or 'Times New Roman'

        # Step 1: Clean and structure notes via Gemini AI
        cleaned_markdown = clean_notes_with_gemini(raw_text)

        # Step 2: Build formatted Word document with native Word OMML equation engine
        try:
            docx_stream = build_docx_from_notes(cleaned_markdown, title=doc_title, font_name=font_family)
        except Exception as gen_err:
            app.logger.warning(f"build_docx_from_notes error, falling back: {gen_err}")
            docx_stream = create_docx_from_markdown(cleaned_markdown, title=doc_title, font_family=font_family)

        # Step 3: Stream as file download
        filename = re.sub(r'[^a-zA-Z0-9_\-]', '_', doc_title.lower()) + ".docx"
        return send_file(
            docx_stream,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            as_attachment=True,
            download_name=filename
        )

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error during conversion: {str(e)}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500


@app.route('/api/preview-clean', methods=['POST'])
def preview_clean_endpoint():
    """Returns the cleaned Markdown text and math preview without generating DOCX."""
    try:
        data = request.get_json(silent=True)
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' in request body."}), 400

        raw_text = data.get('text', '').strip()
        if not raw_text:
            return jsonify({"error": "Please provide text."}), 400

        cleaned = clean_notes_with_gemini(raw_text)
        return jsonify({"cleaned_markdown": cleaned})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def serve_index():
    if os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    return send_file('index.html')


if __name__ == '__main__':
    port = int(os.getenv("PORT", 3000))
    app.run(host='0.0.0.0', port=port, debug=True)
