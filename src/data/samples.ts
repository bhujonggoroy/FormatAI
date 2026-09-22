export interface SampleNote {
  id: string;
  title: string;
  category: string;
  text: string;
}

export const SAMPLE_NOTES: SampleNote[] = [
  {
    id: "stt251-sampling-distributions",
    title: "STT251: Sampling Distributions (Raw Study Guide & Formula Sheet)",
    category: "Statistics & Data Science",
    text: `STT251 Sampling Distributions: A to Z Comprehensive Study Guide & Formula Sheet
1. Introduction and Sampling Distribution Fundamentals
1.1 Definition of Sampling Distribution
A sampling distribution is the probability law or frequency distribution of a statistic (such as
the mean, median, or standard deviation) obtained through repeated random samples of a
fixed size n drawn from a specified population. It represents how outcomes spread apart for
a specific population and is also referred to as a finite sample distribution.
1.2 Key Components
Population (N): The total set of units.
Sample (n): A subset of units selected from the population.
Statistic: A characteristic of the sample (e.g., sample mean \\bar{x}, sample proportion p).
Parameter: A characteristic of the population (e.g., population mean \\mu, population
proportion P or \\pi).
Sampling Error: The difference between the population parameter and the sample statistic
used to estimate it (\\text{Error} = \\mu - \\bar{x}). Sampling error decreases as sample size n
increases.
1.3 Standard Error (SE)
The standard deviation of a sampling distribution is specifically termed the Standard Error.
It measures the dispersion of the sample statistics around the population parameter and
serves as a measure of sampling error.
Statistic
Standard Error Formula (Infinite/Large Population)
Sample Mean (\\bar{x})
SE(\\bar{x}) = \\frac{\\sigma}{\\sqrt{n}}
Sample Proportion (p)
SE(p) = \\sqrt{\\frac{P(1-P)}{n}}
1.4 Finite Population Correction (FPC) Factor
When the population size N is finite and the sample size n is a significant portion of the
population (specifically when the sampling fraction n/N > 0.1), the standard error formula
must be adjusted using the FPC factor.
Standard Error for Finite Population: SE(\\bar{x}) = \\sqrt{\\frac{N-n}{N-1}} \\cdot
\\frac{\\sigma}{\\sqrt{n}}
Variance for Finite Population: \\sigma_{\\bar{x}}^2 = \\left( \\frac{N-n}{N-1} \\right)
\\frac{\\sigma^2}{n}
2. Central Limit Theorem (CLT)
2.1 Historical Context and Theorem
First introduced by De Moivre in the early 18th century, the Central Limit Theorem is the
most fundamental theorem in statistics. It states that regardless of the population
distribution, the sampling distribution of the sample mean will approach a normal
distribution as the sample size n increases.
2.2 Formal Definition
If X is a random variable from any distribution with mean \\mu and variance \\sigma^2:
\\text{As } n \\to \\infty, \\bar{x} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)
2.3 Significance
Allows researchers to make estimates of the population mean even if the underlying
population distribution is unknown.
Sample means cluster together as n increases, improving the precision of the estimate.
3. Distributions of the Mean and Proportion
3.1 Sampling Distribution of the Mean
For a random sample of size n from a population with mean \\mu and standard deviation
\\sigma:
Mean of \\bar{x}: \\mu_{\\bar{x}} = \\mu (The sample mean is an unbiased estimator).
Variance of \\bar{x}: \\sigma_{\\bar{x}}^2 = \\frac{\\sigma^2}{n}.
3.2 Sampling Distribution of the Proportion
When data is classified into two categories (success/failure), we utilize the sample
proportion p = \\frac{X}{n}, where X is the number of successes.
Population Proportion: P = \\frac{k}{N} (where k is population successes).
Mean of p: \\mu_p = P.
Standard Deviation of p: \\sigma_p = \\sqrt{\\frac{P(1-P)}{n}}.
Normality Conditions for Proportions
The sampling distribution of the proportion is approximately normal only if the sample size
is sufficiently large. The exact requirements are:
nP > 15
n(1-P) > 15
If these conditions are not satisfied (e.g., n is small), the distribution follows a Binomial
Distribution instead of a Normal Distribution.
3.3 Difference of Two Sample Proportions
To compare two populations with proportions P_1 and P_2, independent samples of size n_1
and n_2 are drawn.
Mean of the Difference: E[p_1 - p_2] = P_1 - P_2
Standard Error of the Difference: SE(p_1 - p_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-
P_2)}{n_2}}
Normality Conditions for Difference of Proportions: The distribution is approximately
normal if n_1P_1 > 15, n_1(1-P_1) > 15, n_2P_2 > 15, and n_2(1-P_2) > 15.
4. Specific Sampling Distributions
The following distributions are essential for inferential statistics and are categorized as
sampling distributions:
Student’s t-Distribution: Used when the population standard deviation is unknown and the
sample size is small.
Chi-Square (\\chi^2) Distribution: Used for inferences regarding population variance and
goodness-of-fit tests.
Fisher’s F-Distribution: Used for the ratio of two sample variances to compare population
variabilities.
5. Summary Formula Sheet
Concept
Formula
Sample Mean
\\bar{x} = \\frac{1}{n} \\sum x_i
Sample Proportion
p = \\frac{x}{n}
Z-score (Mean)
Z = \\frac{\\bar{x} - \\mu}{\\sigma / \\sqrt{n}}
Z-score (Proportion)
Z = \\frac{p - P}{\\sqrt{\\frac{P(1-P)}{n}}}
Z-score (Diff. Proportions)
Z = \\frac{(p_1 - p_2) - (P_1 - P_2)}{\\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}}
Standard Error (Finite Mean)
SE(\\bar{x}) = \\sqrt{\\frac{N-n}{N-1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}
Expected Value (Proportion)
E[p] = P
Variance (Proportion)
Var(p) = \\frac{P(1-P)}{n}
6. Practical Applications and Inference
Sampling distributions provide the mathematical foundation for all inferential statistics. By
understanding the probability distribution of a statistic:
Generalization: Rules can be laid down to generalize from a single sample to an entire
population.
Risk Calculation: Researchers can calculate the risk of error (chance) involved in
generalizations.
Interval Probability: It becomes possible to calculate the probability that a sample statistic
falls within a specific interval (e.g., within 5 percentage points of the true population
parameter).
`
  },
  {
    id: "stt251-target-formatted",
    title: "STT251: Formatted Target (Academic Study Guide Standard)",
    category: "Statistics & Data Science",
    text: `# STT251: Sampling Distributions
## A–Z Comprehensive Study Guide & Formula Sheet

## 1. Introduction and Sampling Distribution Fundamentals

### 1.1 Definition of Sampling Distribution
A sampling distribution is the probability distribution or frequency distribution of a statistic (such as the mean, median, or standard deviation) obtained from repeated random samples of a fixed size $n$ drawn from a specified population. It represents how outcomes spread apart for a specific population and is also referred to as a finite sample distribution.

### 1.2 Key Components

| Term | Definition |
| :--- | :--- |
| Population ($N$) | The complete set of all units, individuals, or observations of interest |
| Sample ($n$) | A subset of units selected from the population |
| Statistic | A numerical characteristic calculated from a sample, e.g., $\\bar{x}$ or $\\hat{p}$ |
| Parameter | A numerical characteristic of a population, e.g., $\\mu$, $\\sigma$, or $P$ |
| Sampling Error | The difference between a sample statistic and the corresponding population parameter |

For example, for the sample mean,

$$
\\text{Sampling Error} = \\bar{x} - \\mu
$$

The magnitude of sampling error generally decreases as the sample size $n$ increases.

### 1.3 Standard Error (SE)
The standard deviation of a sampling distribution is specifically termed the **Standard Error**. It measures the dispersion of sample statistics around the population parameter and serves as a measure of sampling error.

| Statistic | Standard Error Formula for a Large or Infinite Population |
| :--- | :--- |
| Sample mean, $\\bar{x}$ | $SE(\\bar{x}) = \\frac{\\sigma}{\\sqrt{n}}$ |
| Sample proportion, $\\hat{p}$ | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |

### 1.4 Finite Population Correction (FPC) Factor
When the population size $N$ is finite and the sampling fraction is large, the standard error should be adjusted using the **finite population correction (FPC)** factor.

The correction is generally applied when

$$
\\frac{n}{N} > 0.10
$$

The finite population correction factor is

$$
\\sqrt{\\frac{N - n}{N - 1}}
$$

Therefore, the standard error of the sample mean is

$$
SE(\\bar{X}) = \\sqrt{\\frac{N - n}{N - 1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}
$$

and the finite population variance is

$$
\\sigma_{\\bar{X}}^2 = \\left( \\frac{N - n}{N - 1} \\right) \\frac{\\sigma^2}{n}
$$

## 2. Central Limit Theorem (CLT)

### 2.1 Historical Context and Theorem
First introduced by De Moivre in the early 18th century, the Central Limit Theorem is the most fundamental theorem in statistics. It states that regardless of the population distribution, the sampling distribution of the sample mean will approach a normal distribution as the sample size $n$ increases.

### 2.2 Formal Definition
Let $X$ be a random variable from a population with mean $\\mu$ and variance $\\sigma^2$. Then, as $n \\to \\infty$,

$$
\\bar{X} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)
$$

Equivalently,

$$
\\bar{X} \\approx N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)
$$

for a sufficiently large sample size $n$.

### 2.3 Significance of the CLT
• It enables researchers to make inferences about a population mean even when the population distribution is unknown.
• As $n$ increases, sample means tend to cluster more closely around the population mean $\\mu$.
• It improves the precision of estimates because the standard error decreases as $n$ increases.

## 3. Distributions of the Mean and Proportion

### 3.1 Sampling Distribution of the Mean
For a random sample of size $n$ from a population with mean $\\mu$ and standard deviation $\\sigma$:

$$
\\mu_{\\bar{X}} = E(\\bar{X}) = \\mu
$$

Thus, the sample mean is an **unbiased estimator** of the population mean.

$$
\\text{Var}(\\bar{X}) = \\sigma_{\\bar{X}}^2 = \\frac{\\sigma^2}{n}
$$

$$
\\sigma_{\\bar{X}} = \\frac{\\sigma}{\\sqrt{n}}
$$

### 3.2 Sampling Distribution of the Proportion
For data classified into two categories, such as success and failure, the sample proportion is

$$
\\hat{p} = \\frac{X}{n}
$$

where $X$ is the number of successes in the sample.

The population proportion is

$$
P = \\frac{k}{N}
$$

where $k$ is the number of successes in the population.

The mean of the sampling distribution of $\\hat{p}$ is

$$
\\mu_{\\hat{p}} = E(\\hat{p}) = P
$$

The variance is

$$
\\sigma_{\\hat{p}}^2 = \\text{Var}(\\hat{p}) = \\frac{P(1 - P)}{n}
$$

The standard deviation or standard error is

$$
SE(\\hat{p}) = \\sqrt{\\frac{P(1 - P)}{n}}
$$

#### Normality Conditions for Proportions
The sampling distribution of $\\hat{p}$ is approximately normal when:

$$
nP > 15
$$

and

$$
n(1 - P) > 15
$$

If these conditions are not satisfied, the number of successes $X$ follows a binomial distribution:

$$
X \\sim \\text{Binomial}(n, P)
$$

### 3.3 Difference Between Two Sample Proportions
Suppose independent samples of sizes $n_1$ and $n_2$ are taken from two populations with population proportions $P_1$ and $P_2$, respectively.

The expected value of the difference is

$$
E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2
$$

The standard error of the difference is

$$
SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}
$$

#### Normality Conditions for the Difference of Proportions
The sampling distribution of $\\hat{p}_1 - \\hat{p}_2$ is approximately normal when all of the following conditions hold:

$$
n_1 P_1 > 15
$$

$$
n_1 (1 - P_1) > 15
$$

$$
n_2 P_2 > 15
$$

$$
n_2 (1 - P_2) > 15
$$

## 4. Specific Sampling Distributions
The following distributions are essential in inferential statistics:

| Distribution | Symbol | Main Use |
| :--- | :---: | :--- |
| Student’s $t$-distribution | $t$ | Used for inference about a population mean when $\\sigma$ is unknown, especially for small samples |
| Chi-square distribution | $\\chi^2$ | Used for inference about population variance and goodness-of-fit tests |
| Fisher’s $F$-distribution | $F$ | Used to compare two population variances and in analysis of variance |

## 5. Summary Formula Sheet

| Concept | Formula |
| :--- | :--- |
| Sample mean | $\\bar{x} = \\frac{1}{n} \\sum_{i=1}^n x_i$ |
| Sample proportion | $\\hat{p} = \\frac{x}{n}$ |
| Mean of sample mean | $E(\\bar{X}) = \\mu$ |
| Variance of sample mean | $\\text{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}$ |
| Standard error of sample mean | $SE(\\bar{X}) = \\frac{\\sigma}{\\sqrt{n}}$ |
| Finite-population SE of mean | $SE(\\bar{X}) = \\sqrt{\\frac{N-n}{N-1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}$ |
| Mean of sample proportion | $E(\\hat{p}) = P$ |
| Variance of sample proportion | $\\text{Var}(\\hat{p}) = \\frac{P(1-P)}{n}$ |
| Standard error of sample proportion | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |
| $Z$-score for a mean | $Z = \\frac{\\bar{X} - \\mu}{\\frac{\\sigma}{\\sqrt{n}}}$ |
| $Z$-score for a proportion | $Z = \\frac{\\hat{p} - P}{\\sqrt{\\frac{P(1-P)}{n}}}$ |
| Difference of two proportions | $E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2$ |
| SE of difference of proportions | $SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}$ |
| $Z$-score for difference of proportions | $Z = \\frac{(\\hat{p}_1 - \\hat{p}_2) - (P_1 - P_2)}{\\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}}$ |

## 6. Practical Applications and Inference
Sampling distributions provide the mathematical foundation for inferential statistics. They allow researchers to use information from a sample to make conclusions about an entire population.

### Main Applications
• **Generalization:** Drawing conclusions about a population based on sample information.
• **Risk calculation:** Estimating the probability of sampling error in a conclusion.
• **Confidence intervals:** Determining a likely range for an unknown population parameter.
• **Hypothesis testing:** Assessing whether sample evidence supports or contradicts a population claim.
• **Interval probability:** Calculating the probability that a sample statistic lies within a specified interval around the true population parameter.

For example, a researcher may calculate the probability that a sample proportion $\\hat{p}$ lies within 0.05 of the true population proportion $P$:

$$
P(|\\hat{p} - P| < 0.05)
$$
`
  },
  {
    id: "inferential-statistics",
    title: "Inferential Statistics & Sampling (AI Lecture Outline)",
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
