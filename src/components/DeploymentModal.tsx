import React, { useState, useEffect } from "react";
import { X, Copy, Check, Terminal, Cloud, Server, FileCode, ExternalLink, Download } from "lucide-react";

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"overview" | "vercel" | "render" | "local" | "files">("overview");
  const [selectedFile, setSelectedFile] = useState<string>("app.py");
  const [copiedFile, setCopiedFile] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetch("/api/project-files")
        .then((res) => res.json())
        .then((data) => setProjectFiles(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Python Backend & Serverless Deployment
              </h2>
              <p className="text-xs text-slate-500">
                Deployable on Vercel Serverless, Render Web Service, or local Python Flask
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Architecture
          </button>
          <button
            onClick={() => setActiveTab("vercel")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "vercel"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Deploy to Vercel (Free)
          </button>
          <button
            onClick={() => setActiveTab("render")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "render"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Deploy to Render (Free)
          </button>
          <button
            onClick={() => setActiveTab("local")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "local"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Local Setup
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "files"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Code Inspector ({Object.keys(projectFiles).length || 6} files)
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs leading-relaxed text-blue-900">
                <strong>Project Purpose:</strong> Users copy raw notes from Google NotebookLM containing math expressions and LaTeX. This app normalizes the notes using the Google Gemini API (model: <code>gemini-2.0-flash</code> or <code>gemini-3.8-flash</code>), converts formulas into clean Unicode math, and uses <code>python-docx</code> to generate a formatted Word file.
              </div>

              <h3 className="text-sm font-bold text-slate-900">Tech Stack & Architecture</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="font-semibold text-slate-900 mb-1">Backend Runtime</div>
                  <p className="text-slate-600">Python 3.10+ with Flask, python-docx, and google-generativeai. Configured for serverless functions on Vercel and containerized web services on Render.</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="font-semibold text-slate-900 mb-1">AI Prompt Normalization</div>
                  <p className="text-slate-600">Prompts Gemini to correct broken LaTeX, preserve 100% of facts, structure headings/bullets, and replace raw math with Unicode notation.</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="font-semibold text-slate-900 mb-1">Document Generation</div>
                  <p className="text-slate-600"><code>python-docx</code> creates hierarchical headings (H1/H2/H3), bullet & numbered lists, bold/italic runs, and table callouts.</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="font-semibold text-slate-900 mb-1">API Key Security</div>
                  <p className="text-slate-600">Loaded exclusively via <code>GEMINI_API_KEY</code> environment variable on the server side; never hardcoded or exposed to the client.</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Get your free Gemini API Key from Google AI Studio
                </a>
              </div>
            </div>
          )}

          {activeTab === "vercel" && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">How to Deploy to Vercel (Free Serverless)</h3>
              <ol className="list-decimal pl-5 space-y-2.5 text-slate-600">
                <li>
                  <strong>Push this project to GitHub</strong>:
                  <pre className="bg-slate-900 text-slate-200 p-2.5 rounded-lg mt-1 overflow-x-auto text-[11px] font-mono">
{`git init
git add .
git commit -m "NotebookLM to DOCX Converter"
git remote add origin https://github.com/your-username/notebooklm-to-docx.git
git push -u origin main`}
                  </pre>
                </li>
                <li>
                  Sign in to <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Vercel.com</a> and click <strong>"Add New Project"</strong>.
                </li>
                <li>
                  Select your GitHub repository. Vercel automatically detects the included <code>vercel.json</code> and <code>requirements.txt</code>.
                </li>
                <li>
                  Under <strong>Environment Variables</strong>, add:
                  <div className="bg-slate-100 p-2 rounded border border-slate-200 font-mono text-[11px] mt-1">
                    Name: <strong>GEMINI_API_KEY</strong><br />
                    Value: <strong>your_api_key_from_ai_studio</strong>
                  </div>
                </li>
                <li>
                  Click <strong>Deploy</strong>. Vercel provisions the Python serverless runtime at <code>/convert</code> and serves the static frontend!
                </li>
              </ol>
            </div>
          )}

          {activeTab === "render" && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">How to Deploy to Render (Free Web Service)</h3>
              <ol className="list-decimal pl-5 space-y-2.5 text-slate-600">
                <li>
                  Push the code to GitHub.
                </li>
                <li>
                  Sign in to <a href="https://render.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Render.com</a> and click <strong>"New +" &gt; "Web Service"</strong>.
                </li>
                <li>
                  Select your repository. Configure:
                  <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px] mt-1">
                    <div>Environment: <strong>Python 3</strong></div>
                    <div>Build Command: <strong>pip install -r requirements.txt</strong></div>
                    <div>Start Command: <strong>gunicorn app:app</strong></div>
                    <div>Plan: <strong>Free</strong></div>
                  </div>
                </li>
                <li>
                  Under <strong>Environment Variables</strong>, add <code>GEMINI_API_KEY</code> with your key.
                </li>
                <li>
                  Click <strong>Create Web Service</strong>. Render automatically builds the dependencies and starts the app with Gunicorn.
                </li>
              </ol>
            </div>
          )}

          {activeTab === "local" && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Running Python Backend Locally</h3>
              <pre className="bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
{`# 1. Create a virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\\Scripts\\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env file with your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 4. Run Flask backend
python app.py`}
              </pre>
              <p className="text-slate-600">
                Open <code>http://localhost:3000</code> in your browser to paste notes and convert to DOCX.
              </p>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {["app.py", "requirements.txt", "vercel.json", "render.yaml", "Procfile", "README.md"].map((fileName) => (
                    <button
                      key={fileName}
                      onClick={() => setSelectedFile(fileName)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                        selectedFile === fileName
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {fileName}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(projectFiles[selectedFile] || "")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                  >
                    {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFile ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    onClick={() => handleDownloadFile(selectedFile, projectFiles[selectedFile] || "")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-80 overflow-y-auto leading-relaxed">
                  {projectFiles[selectedFile] || `Loading ${selectedFile}...`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>All files ready in project root for git push and deployment.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
