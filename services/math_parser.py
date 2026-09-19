"""
Mathematical expression standardizer & notation repair module.
Handles AI output anomalies, crude pseudo-math notation, broken LaTeX, and unescaped symbols.
"""

import re

GREEK_LETTERS = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
    'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'
]


def clean_notebooklm_tree_artifacts(text: str) -> str:
    """Strips tree-drawing pipes and branch characters copied from NotebookLM."""
    if not text:
        return text

    lines = text.split('\n')
    result: list[str] = []

    for line in lines:
        trimmed = line.strip()
        # Filter out standalone vertical pipes or tree lines
        if not trimmed or trimmed in ('|', '│', '¦'):
            continue

        # Detect tree outline prefix: | | ├── or | └── etc.
        if re.match(r'^[|│\s]*(?:├──|└──|├─|└─|\|─|\+-|\+--)', trimmed):
            pipe_count = len(re.findall(r'[|│]', trimmed))
            stripped = re.sub(r'^[|│\s]*(?:├──|└──|├─|└─|\|─|\+-|\+--)\s*', '', trimmed)

            if not stripped:
                continue

            # Section number (e.g. 2.3 Sample Size Dynamics)
            if re.match(r'^\d+(\.\d+)+\s+', stripped):
                result.append(f"### {stripped}")
                continue

            indent = max(0, pipe_count - 1)
            prefix = ('  ' * indent) + '- '
            result.append(prefix + stripped)
            continue

        # Strip single leading pipe from start of line unless it's a markdown table line (which ends with a pipe)
        if re.match(r'^[|│]\s+', trimmed) and not trimmed.endswith('|'):
            result.append(re.sub(r'^[|│]\s+', '', trimmed))
            continue

        result.append(line)

    return '\n'.join(result)


def repair_crude_math_patterns(text: str) -> str:
    """
    Repairs crude pseudo-math notation in non-LaTeX text:
    e.g. 'x2' -> 'x^2', 'X~N(mu, sigma2)' -> '$X \sim N(\mu, \sigma^2)$'
    Preserves all existing LaTeX expressions without corrupting escape characters.
    """
    if not text:
        return text

    # Standardize typographical characters
    s = text.replace('−', '-').replace('–', '-')
    s = s.replace('’', "'").replace('‘', "'").replace('”', '"').replace('“', '"')

    # Tokenize: isolate existing $$...$$, $...$, and `...` blocks
    # Use standard non-greedy regex
    math_token_pattern = re.compile(r'(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|`[^`\n]+?`)')
    tokens = math_token_pattern.split(s)

    cleaned_tokens = []
    for idx, token in enumerate(tokens):
        # Odd indexes are inside $$...$$, $...$, or `...`
        if idx % 2 == 1:
            cleaned_tokens.append(token)
            continue

        # Outside math: perform safe normalization
        t = token

        # Normal distribution density function if written in raw text
        t = re.sub(
            r'1\s*/\s*(?:√|\\sqrt\{?)(?:2\s*π\s*σ2|2\s*\\pi\s*\\sigma\^?2|2\\pi\\sigma\^?2)\}?\s*e\s*[-−]\s*\(\s*x\s*[-−]\s*(?:μ|\\mu)\s*\)\s*(?:\^?2|²)\s*/\s*2\s*(?:σ2|\\sigma\^?2|σ²)',
            lambda _: r'$\frac{1}{\sqrt{2\pi\sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}}$',
            t
        )

        # Sample mean / variance formulas in plain text
        t = re.sub(
            r'(?:x̄|\\bar\{x\}|\bxbar\b)\s*=\s*(?:Σ|\\sum)\s*x[i_]\s*/\s*n\b',
            lambda _: r'$\bar{x} = \frac{\sum_{i=1}^n x_i}{n}$',
            t
        )
        t = re.sub(
            r'(?:σ2|σ²|\\sigma\^?2)\s*=\s*(?:Σ|\\sum)\s*\(\s*x[i_]\s*-\s*(?:x̄|\\bar\{x\}|\bxbar\b)\s*\)\s*(?:\^?2|²)\s*/\s*n\b',
            lambda _: r'$\sigma^2 = \frac{\sum_{i=1}^n (x_i - \bar{x})^2}{n}$',
            t
        )

        # Normal distribution notation: X~N(μ,σ2) or X ~ N(mu, sigma^2)
        t = re.sub(
            r'\b([A-Z])\s*~?\s*N\s*\(\s*(?:μ|mu|\\mu)\s*,\s*(?:σ2|σ²|sigma2|\\sigma\^?2)\s*\)',
            lambda m: rf'${m.group(1)} \sim N(\mu, \sigma^2)$',
            t
        )

        # Standard Error formulas:
        t = re.sub(
            r'SE\s*\(\s*p̂\s*\)\s*=\s*(?:√|\\sqrt)\s*\[?\s*p\s*\(\s*1\s*-\s*p\s*\)\s*/\s*n\s*\]?',
            lambda _: r'$SE(\hat{p}) = \sqrt{\frac{p(1 - p)}{n}}$',
            t
        )
        t = re.sub(
            r'SE\s*\(\s*X̄₁\s*-\s*X̄₂\s*\)\s*=\s*(?:√|\\sqrt)\s*\[?\s*\(?\s*σ₁²\s*/\s*n₁\s*\)?\s*\+\s*\(?\s*σ₂²\s*/\s*n₂\s*\)?\s*\]?',
            lambda _: r'$SE(\bar{X}_1 - \bar{X}_2) = \sqrt{\frac{\sigma_1^2}{n_1} + \frac{\sigma_2^2}{n_2}}$',
            t
        )

        # Radicals written with unicode √
        t = re.sub(r'√\[([^\[\]]+)\]', lambda m: rf'$\sqrt{{{m.group(1)}}}$', t)
        t = re.sub(r'√\(([^()]+)\)', lambda m: rf'$\sqrt{{{m.group(1)}}}$', t)

        # Raw \frac outside $
        t = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', lambda m: rf'${m.group(0)}$', t)

        cleaned_tokens.append(t)

    return ''.join(cleaned_tokens)
