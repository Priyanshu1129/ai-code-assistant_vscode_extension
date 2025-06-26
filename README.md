# AI Dev Assistant

A VS Code extension paired with a Python (FastAPI + Watchdog) backend to power a Retrieval-Augmented Generation (RAG)–based coding assistant.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Bundling & Packaging](#bundling--packaging)
4. [Installation from VSIX](#installation-from-vsix)
5. [Workspace Structure](#workspace-structure)
6. [Extension Settings](#extension-settings)

---

## Prerequisites

- **Python 3.8+** on your system `PATH`.
- **Node.js 16+** (for building the extension frontend).
- **VSCE** CLI for packaging: install globally with:
  ```bash
  npm install -g vsce
  ```

---

## Local Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Priyanshu1129/ai-code-assistant_vscode_extension.git
   cd ai-code-assistant_vscode_extension
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Create & activate Python virtual environment**
   ```bash
   cd backend
   python -m venv .venv
   # macOS/Linux
   source .venv/bin/activate
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   ```

4. **Install Python requirements**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment variables**
   - Copy `.env.example` (if present) or create a `.env` file in `backend/`:
     ```ini
     HF_API_KEY=your_huggingface_api_key_here
     ```

6. **Build the extension frontend**
   ```bash
   npm run build:js
   ```

7. **Launch VS Code in this folder**
   ```bash
   cd ..      # go back to repo root
   code .     # or open in VS Code manually
   ```
   - Press <kbd>F5</kbd> to run in the Extension Development Host.

---

## Bundling & Packaging

Before publishing or installing for others, you need to bundle the JS and package the extension:

1. **Bundle the frontend** (runs `esbuild`):
   ```bash
   npm run build:js
   ```

2. **Package into a VSIX**:
   ```bash
   vsce package
   ```
   - This produces something like `ai-dev-assistant-0.0.1.vsix`.

---

## Installation from VSIX

If you’re a user cloning the repo, or installing the published VSIX:

1. **Build the VSIX** (see above).
2. **Open in VS Code** → <kbd>Extensions</kbd> panel → click the “...” menu → **Install from VSIX...**.
3. **Post-install**: open a terminal in the extension’s `backend/` folder and:
   ```bash
   python -m venv .venv      # if not already created
   # activate it:
   source .venv/bin/activate  # macOS/Linux
   .\.venv\Scripts\Activate.ps1  # Windows PowerShell
   pip install -r requirements.txt
   ```
4. **Create `.env`** in `backend/` and set:
   ```ini
   HF_API_KEY=your_huggingface_api_key_here
   ```
5. **Reload Window** in VS Code and ensure your API Key is set under Settings → AI Dev Assistant.

---

## Workspace Structure

```
ai-dev-assistant/                ← extension root
├── extension.js                 ← VS Code extension entrypoint
├── package.json                 ← npm metadata, commands
├── esbuild.js                   ← bundler config
├── .vscodeignore                ← files to exclude from package
├── backend/                     ← Python backend
│   ├── .venv/                   ← Python virtualenv (not committed)
│   ├── main.py                  ← FastAPI + watcher startup
│   ├── watcher.py               ← filesystem-watcher logic
│   ├── rag_pipeline.py          ← chunk-retrieval code
│   ├── llm_cloud.py             ← LLM-query wrapper
│   ├── embeddings.py            ← vector index & embed logic
│   ├── .env                     ← env vars (HF_API_KEY, etc)
│   └── requirements.txt         ← Python deps
└── README.md
```

---

## Extension Settings

After installation, set your API key in VS Code Settings:

- **AI Dev Assistant › Hf Api Key**: your Hugging Face Inference API key.

Enjoy building with your RAG-powered AI coding assistant! 🚀
```
