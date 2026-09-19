from services.docx_generator import build_docx_from_notes

markdown_sample = """# Statistical Inference & Normal Distribution

The normal probability density function is given by:

$$f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}$$

Key estimators:
- Sample Mean: $\\bar{x} = \\frac{\\sum_{i=1}^n x_i}{n}$
- Sample Variance: $s^2 = \\frac{\\sum_{i=1}^n (x_i - \\bar{x})^2}{n-1}$
- Confidence Interval: $\\bar{x} \\pm z^* \\frac{\\sigma}{\\sqrt{n}}$

| Parameter | Estimator | Standard Error |
| :--- | :--- | :--- |
| Mean $\\mu$ | $\\bar{x}$ | $\\sigma / \\sqrt{n}$ |
| Proportion $p$ | $\\hat{p}$ | $\\sqrt{\\frac{p(1-p)}{n}}$ |

> Note: For small samples ($n < 30$), use Student's $t$-distribution with $\\nu = n - 1$ degrees of freedom.
"""

buf = build_docx_from_notes(markdown_sample, title="Statistics Review")
with open("/tmp/test_output.docx", "wb") as f:
    f.write(buf.read())

print("SUCCESS! File size:", len(open("/tmp/test_output.docx", "rb").read()))
