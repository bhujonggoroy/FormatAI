export interface SampleNote {
  id: string;
  title: string;
  category: string;
  text: string;
}

export const SAMPLE_NOTES: SampleNote[] = [
  {
    id: "inferential-statistics",
    title: "Inferential Statistics & Sampling (NotebookLM Outline)",
    category: "Statistics & Data Science",
    text: `1. Foundations of Estimation

| ├── 1.2 Parameter vs. Statistic
| | ├── Parameter ($\theta$): An unknown, fixed numerical characteristic of the population (e.g., population mean \\mu, population variance \\sigma^2, population proportion p).
| | └── Statistic ($T$): A function of the observable sample data that does not depend on any unknown parameters (e.g., sample mean \\bar{X}, sample variance S^2, sample proportion \\hat{p}).
| ├── 2.1 Standard Error Formulas
| | ├── Sample Proportion: SE(p̂) = √[p(1 - p) / n]
| | ├── Difference of Means: SE(X̄₁ - X̄₂) = √[(σ₁² / n₁) + (σ₂² / n₂)]
| | └── Difference of Proportions: SE(p̂₁ - p̂₂) = √[(p₁q₁ / n₁) + (p₂q₂ / n₂)]
| ├── 2.3 Sample Size Dynamics
| | └── Inverse relationship: SE ∝ 1 / √n (quadrupling n reduces SE by 50%)
| └── 2.4 Finite Population Correction (FPC)
| └── Multiplier: √[(N - n) / (N - 1)] applied when sampling without replacement
|
Confidence Intervals:
CI = Point Estimate ± (Critical Value * Standard Error)
For a 95% confidence interval using the standard normal distribution:
Z* = 1.96, therefore:
CI = X̄ ± 1.96 * (σ / √n)
`
  },
  {
    id: "thermodynamics",
    title: "Thermodynamics & Heat Transfer",
    category: "Physics & Engineering",
    text: `Chapter 4: Thermodynamics and Entropy

Key takeaways from lecture:
The first law states that change in internal energy \\Delta U is equal to heat added Q minus work done W:
\\Delta U = Q - W
where W = \\int_{V_1}^{V_2} P \\, dV for quasi-static expansion.

Second Law of Thermodynamics:
Entropy S of an isolated system never decreases over time:
dS \\ge \\frac{dQ_{rev}}{T}
For an ideal gas undergoing an isothermal process at temperature T:
\\Delta S = n R \\ln(\\frac{V_2}{V_1}) where R = 8.314 J/(mol \\cdot K).

Carnot Cycle efficiency \\eta:
\\eta = 1 - \\frac{T_C}{T_H} = \\frac{W_{net}}{Q_H}

Heat conduction equation (Fourier's Law):
q = -k \\nabla T = -k \\frac{dT}{dx}
In 3D cylindrical coordinates:
\\frac{1}{r} \\frac{\\partial}{\\partial r}(r \\frac{\\partial T}{\\partial r}) + \\frac{\\dot{q}}{k} = \\frac{1}{\\alpha} \\frac{\\partial T}{\\partial t}
where \\alpha = \\frac{k}{\\rho c_p} is the thermal diffusivity.

Important constants to remember:
- Boltzmann constant: k_B = 1.380649 \\times 10^{-23} J/K
- Stefan-Boltzmann constant: \\sigma = 5.670374 \\times 10^{-8} W/(m^2 K^4)
- Avogadro constant: N_A = 6.02214076 \\times 10^{23} mol^{-1}
`
  },
  {
    id: "machine-learning",
    title: "Neural Networks & Optimization",
    category: "Computer Science",
    text: `Deep Learning Optimization Lecture Notes

Loss functions:
Binary Cross-Entropy Loss (BCE) for N training examples:
L_{BCE} = -\\frac{1}{N} \\sum_{i=1}^{N} [y_i \\log(\\hat{y}_i) + (1 - y_i) \\log(1 - \\hat{y}_i)]
where \\hat{y}_i = \\sigma(z_i) = \\frac{1}{1 + e^{-z_i}} is the sigmoid activation function.

Gradient Descent update rule:
\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta L(\\theta_t)
where \\eta is the learning rate.

Adam Optimizer (Adaptive Moment Estimation):
First moment estimate:
m_t = \\beta_1 m_{t-1} + (1 - \\beta_1) g_t
Second moment estimate:
v_t = \\beta_2 v_{t-1} + (1 - \\beta_2) g_t^2
Bias correction formulas:
\\hat{m}_t = \\frac{m_t}{1 - \\beta_1^t}, \\quad \\hat{v}_t = \\frac{v_t}{1 - \\beta_2^t}
Parameter update step:
\\theta_{t+1} = \\theta_t - \\frac{\\eta}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t

Common Hyperparameters:
- \\beta_1 = 0.9
- \\beta_2 = 0.999
- \\epsilon = 10^{-8}
`
  },
  {
    id: "calculus",
    title: "Multivariable Calculus & Line Integrals",
    category: "Mathematics",
    text: `Lecture 9: Vector Fields and Green's Theorem

Definition of Curl and Divergence:
Let \\mathbf{F}(x, y, z) = P\\mathbf{i} + Q\\mathbf{j} + R\\mathbf{k} be a vector field in \\mathbb{R}^3.
The divergence is defined as:
\\text{div} \\, \\mathbf{F} = \\nabla \\cdot \\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}

The curl of \\mathbf{F} is:
\\text{curl} \\, \\mathbf{F} = \\nabla \\times \\mathbf{F} = (\\frac{\\partial R}{\\partial y} - \\frac{\\partial Q}{\\partial z})\\mathbf{i} + (\\frac{\\partial P}{\\partial z} - \\frac{\\partial R}{\\partial x})\\mathbf{j} + (\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y})\\mathbf{k}

Green's Theorem in the plane:
Let C be a positively oriented, piecewise smooth, simple closed curve in a plane, bounding region D.
\\oint_C (P \\, dx + Q \\, dy) = \\iint_D (\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}) \\, dA

Fundamental Theorem of Line Integrals:
\\int_C \\nabla f \\cdot d\\mathbf{r} = f(\\mathbf{r}(b)) - f(\\mathbf{r}(a))
Notice that if \\text{curl} \\, \\mathbf{F} = \\mathbf{0}, the field is conservative and path-independent!
`
  },
  {
    id: "sampling-distributions",
    title: "5. Continuous Sampling Distributions (Student's t, Chi-Square)",
    category: "Statistics & Probability",
    text: `# 5. Continuous Sampling Distributions

• Key Moments: Mean = n, Variance = 2n, Mode = n - 2 (for n > 2).
• Moment Generating Function (MGF):

$$
M(t) = (1 - 2t)^{-n/2} \\quad \\text{for } t < \\frac{1}{2}
$$

• Additive Property: If U_i ~ \\chi^2_{n_i} are independent, then:

$$
\\sum U_i \\sim \\chi^2_{\\sum n_i}
$$

5.2 Student's $t$-Distribution ($t_\\nu$)
• Definition:

$$
T = \\frac{Z}{\\sqrt{\\frac{\\chi^2}{\\nu}}} \\sim t_\\nu
$$

when Z ~ N(0,1) and \\chi^2 ~ \\chi^2_\\nu are independent random variables.
• Symmetry & Moments: Symmetric about 0 (all odd moments vanish). Mean = 0 (for \\nu > 1), Variance = \\frac{\\nu}{\\nu - 2} (for \\nu > 2).
`
  }
];
