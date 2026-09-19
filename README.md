# NotebookLM to DOCX Converter

A lightweight, serverless-ready web application that takes messy, raw study notes and summaries copied from **Google NotebookLM** (including broken LaTeX, truncated math equations, and unstructured formatting), cleans them up with **Google Gemini AI**, converts math expressions into crystal-clear **Unicode math notation**, and exports a publication-grade Microsoft Word (**`.docx`**) document.

---

## Features

- **Google Gemini AI Normalization**: Intelligent cleanup of unstructured NotebookLM copy-pastes, fixing LaTeX syntax errors, unclosed brackets, and broken tokens.
- **Unicode Math Engine**: Automatically renders superscripts (² ³ ⁿ), subscripts (₀ ₁ ₖ), Greek symbols (α, β, θ, λ, π, Δ), and calculus/algebra operators (∫, ∑, √, ∂, ±, ≤, ≥, ≠, ≈) so formulas look crisp in Word without requiring external equation plugins.
- **Semantic DOCX Structuring**: Uses `python-docx` to apply hierarchical heading styles (Heading 1/2/3), bullet points, numbered lists, bold keywords, code blocks, and formula callout boxes.
- **Ready for Free Serverless Deployment**: Configured out-of-the-box for **Vercel** (Serverless Python functions) and **Render** (Free Web Service tier).
- **Interactive Live Preview**: Clean split-pane web UI with pre-loaded academic samples (Thermodynamics, Machine Learning, Calculus).

---

## How It Works

```
[Raw NotebookLM Notes]
          │
          ▼
1. Gemini API (gemini-2.0-flash / gemini-3.8-flash)
   - Normalizes LaTeX & math notation
   - Organizes content into Markdown headings (#, ##, ###), bold & lists
   - Preserves 100% of factual content (no summarization)
          │
          ▼
2. Unicode Math Sanitizer
   - Converts symbols: \alpha -> α, \sum -> ∑, \sqrt -> √, x^2 -> x²
          │
          ▼
3. python-docx Document Builder
   - Formats typography, margins, heading accents & callout cards
          │
          ▼
[Clean .docx File Downloaded Directly to User's Computer]
```

---

## How to Get a Free Gemini API Key

1. Visit **[Google AI Studio](https://aistudio.google.com/apikey)**.
2. Sign in with your Google Account.
3. Click **"Get API key"** (or **"Create API key"**).
4. Select or create a Google Cloud project.
5. Copy your API key (starts with `AIza...`).
6. Keep this key safe. You will add it as the `GEMINI_API_KEY` environment variable.

---

## Free Deployment Options

### Option A: Deploy to Vercel (Serverless Free Tier)

Vercel natively supports Python serverless functions via `@vercel/python`.

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of NotebookLM to DOCX Converter"
   git branch -M main
   git remote add origin https://github.com/your-username/notebooklm-docx-converter.git
   git push -u origin main
   ```

2. **Import Project into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** > **"Project"**.
   - Select your GitHub repository.

3. **Configure Environment Variable**:
   - In the project configuration screen, expand **"Environment Variables"**.
   - Key: `GEMINI_API_KEY`
   - Value: `YOUR_GEMINI_API_KEY` (paste your AI Studio key)
   - Click **"Add"**.

4. **Deploy**:
   - Click **"Deploy"**.
   - Vercel will build the serverless functions using `vercel.json` and `requirements.txt`.
   - Your converter is live at `https://your-project.vercel.app`!

---

### Option B: Deploy to Render (Free Web Service)

Render provides a 100% free web service tier with full Python & Gunicorn support.

1. **Push your repository to GitHub** (as shown above).

2. **Create a New Web Service on Render**:
   - Go to [render.com](https://render.com) and sign in.
   - Click **"New +"** and select **"Web Service"**.
   - Connect your GitHub account and select your repository.

3. **Configure the Service**:
   - **Name**: `notebooklm-docx-converter`
   - **Language / Environment**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: `Free`

4. **Add the Environment Variable**:
   - Scroll down to **"Environment Variables"**.
   - Click **"Add Environment Variable"**.
   - Key: `GEMINI_API_KEY`
   - Value: `YOUR_GEMINI_API_KEY`

5. **Deploy**:
   - Click **"Create Web Service"**.
   - Render will provision the container, install packages, and launch Gunicorn.
   - Your app will be accessible at `https://notebooklm-docx-converter.onrender.com`.

---

## Local Development Setup

To run the Flask backend and test conversion locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/notebooklm-docx-converter.git
   cd notebooklm-docx-converter
   ```

2. **Create a Python virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure your API Key**:
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   PORT=5000
   ```

5. **Run the server**:
   ```bash
   python app.py
   ```
   Open `http://localhost:5000` in your web browser.

---

## API Reference

### `POST /convert`
Takes raw text and returns a streamed `.docx` file attachment.

**Request Body (JSON):**
```json
{
  "text": "Your raw NotebookLM notes with formulas...",
  "title": "Thermodynamics Chapter 3",
  "font": "Calibri"
}
```

**Response:**
- Binary `application/vnd.openxmlformats-officedocument.wordprocessingml.document` download.

### `POST /api/preview-clean`
Returns the cleaned Markdown structure and Unicode math text without generating a DOCX binary.

**Response (JSON):**
```json
{
  "cleaned_markdown": "# Thermodynamics Chapter 3\n\n## 1. First Law of Thermodynamics\n..."
}
```

---

## License
MIT License. Open source and free for students, researchers, and educators.
