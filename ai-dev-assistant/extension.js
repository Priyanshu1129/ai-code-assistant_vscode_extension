const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const treeKill = require("tree-kill");

let outputChannel;
let serverProcess;

/**
 * Starts (or restarts) the Python backend + watcher for the given workspace folder.
 */
let backendPort = null;

function startBackend(workspacePath, context) {
  if (serverProcess && serverProcess.pid) {
    outputChannel.appendLine(`🛑 Killing backend PID ${serverProcess.pid}…`);
    treeKill(serverProcess.pid, "SIGKILL", (err) => {
      if (err) {
        outputChannel.appendLine(`❌ Failed to kill process: ${err}`);
      } else {
        outputChannel.appendLine(
          `✅ Backend process ${serverProcess.pid} killed`
        );
      }
    });
  }

  const backendDir = path.join(context.extensionPath, "backend");
  const mainPy = path.join(backendDir, "main.py");

  const winPy = path.join(backendDir, "venv", "Scripts", "python.exe");
  const nixPy = path.join(backendDir, "venv", "bin", "python");
  const pythonExe = fs.existsSync(winPy)
    ? winPy
    : fs.existsSync(nixPy)
    ? nixPy
    : "python";

  outputChannel.appendLine(`🐍 Using Python: ${pythonExe}`);
  outputChannel.appendLine(`🚀 Starting backend for: ${workspacePath}`);

  serverProcess = cp.spawn(pythonExe, ["main.py"], {
    cwd: backendDir,
    env: {
      ...process.env,
      WORKSPACE_PATH: workspacePath,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
    },
    shell: false,
  });

  serverProcess.stdout.on("data", (chunk) => {
    const line = chunk.toString().trim();
    outputChannel.appendLine(`[Backend] ${line}`);

    if (line.startsWith("PORT::")) {
      backendPort = line.replace("PORT::", "").trim();
      outputChannel.appendLine(`✅ Backend listening on port ${backendPort}`);
    }
  });

  serverProcess.stderr.on("data", (chunk) =>
    outputChannel.appendLine(`[Backend ERROR] ${chunk.toString().trim()}`)
  );

  serverProcess.on("exit", (code) => {
    outputChannel.appendLine(`⚠️ Backend exited with code ${code}`);
    backendPort = null;
    if (code !== 0) {
      vscode.window.showErrorMessage(
        `AI Assistant backend exited (${code}). Check logs for details.`
      );
    }
  });
}

// function startBackend(workspacePath, context) {
//   // Kill any old process first
//   if (serverProcess && !serverProcess.killed) {
//     outputChannel.appendLine("🛑 Killing previous backend…");
//     serverProcess.kill();
//   }

//   // Resolve paths
//   const backendDir = path.join(context.extensionPath, "backend");
//   const mainPy = path.join(backendDir, "main.py");

//   // Find the right python executable (venv or system)
//   const winPy = path.join(backendDir, "venv", "Scripts", "python.exe");
//   const nixPy = path.join(backendDir, "venv", "bin", "python");
//   let pythonExe = fs.existsSync(winPy)
//     ? winPy
//     : fs.existsSync(nixPy)
//     ? nixPy
//     : "python";

//   outputChannel.appendLine(`🐍 Using Python: ${pythonExe}`);
//   outputChannel.appendLine(`🚀 Starting backend for: ${workspacePath}`);

//   serverProcess = cp.spawn(pythonExe, ["main.py"], {
//     cwd: backendDir,
//     env: {
//       ...process.env,
//       WORKSPACE_PATH: workspacePath,
//       PYTHONIOENCODING: "utf-8",
//       PYTHONUNBUFFERED: "1",
//     },
//     shell: true,
//   });

//   serverProcess.stdout.on("data", (chunk) =>
//     outputChannel.appendLine(`[Backend] ${chunk.toString().trim()}`)
//   );
//   serverProcess.stderr.on("data", (chunk) =>
//     outputChannel.appendLine(`[Backend ERROR] ${chunk.toString().trim()}`)
//   );
//   serverProcess.on("exit", (code) => {
//     outputChannel.appendLine(`⚠️ Backend exited with code ${code}`);
//     if (code !== 0) {
//       vscode.window.showErrorMessage(
//         `AI Assistant backend exited (${code}). Check logs for details.`
//       );
//     }
//   });
// }

function activate(context) {
  // 1) Create & show our logs channel
  outputChannel = vscode.window.createOutputChannel("AI Assistant Logs");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("🚀 Activating AI Code Assistant…");
  outputChannel.show(true);

  // 2) On startup, start backend for the first open folder
  const initialWF = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (initialWF) {
    outputChannel.appendLine(`📂 Initial workspace: ${initialWF}`);
    startBackend(initialWF, context);
  } else {
    outputChannel.appendLine("⚠️ No folder open — backend not started");
  }

  // 3) Whenever the user adds/removes/switches workspace folders, restart
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((evt) => {
      const next = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (next) {
        outputChannel.appendLine(`🔄 Workspace changed — now: ${next}`);
        startBackend(next, context);
      }
    })
  );

  // 4) Register your “Ask Question” command exactly as before
  const askCmd = vscode.commands.registerCommand(
    "ai-dev-assistant.askQuestion",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "aiDevAssistant",
        "AI Assistant Chat",
        vscode.ViewColumn.One,
        { enableScripts: true }
      );
      panel.webview.html = getWebviewContent();
      panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.command === "ask") {
          try {
            const res = await fetch(`http://localhost:${backendPort}/query`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question: msg.text }),
            });
            const data = await res.json();
            panel.webview.postMessage({
              command: "response",
              text: data.answer,
            });
          } catch (err) {
            panel.webview.postMessage({
              command: "response",
              text: `❌ ${err}`,
            });
          }
        }
      });
    }
  );
  context.subscriptions.push(askCmd);

  // 5) Optional “Show Logs” command
  const showLogsCmd = vscode.commands.registerCommand(
    "ai-dev-assistant.showLogs",
    () => outputChannel.show(true)
  );
  context.subscriptions.push(showLogsCmd);
}

function deactivate() {
  if (serverProcess && serverProcess.pid) {
    outputChannel.appendLine(`🛑 Killing backend PID ${serverProcess.pid}…`);
    treeKill(serverProcess.pid, "SIGKILL", (err) => {
      if (err) {
        outputChannel.appendLine(`❌ Failed to kill process: ${err}`);
      } else {
        outputChannel.appendLine(
          `✅ Backend process ${serverProcess.pid} killed`
        );
      }
    });
  }
}

function getWebviewContent() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #0f172a;
        color: #f1f5f9;
        overflow: hidden;
      }

      .header {
        padding: 16px;
        background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%);
        border-bottom: 1px solid #1e293b;
        text-align: center;
        position: relative;
      }

      .header h2 {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .header-icon {
        color: #60a5fa;
      }

      #chat-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #0f172a 0%, #0d1528 100%);
      }

      .welcome-message {
        margin: auto;
        text-align: center;
        max-width: 80%;
        opacity: 0.8;
        animation: fadeIn 0.8s ease-out;
      }

      .welcome-message h3 {
        font-size: 24px;
        margin-bottom: 16px;
        color: #e2e8f0;
        font-weight: 500;
      }

      .welcome-message p {
        font-size: 15px;
        color: #94a3b8;
        line-height: 1.6;
      }

      .welcome-icon {
        font-size: 48px;
        margin-bottom: 20px;
        color: #60a5fa;
      }

      .message {
        margin: 12px 0;
        padding: 14px 18px;
        border-radius: 14px;
        max-width: 85%;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        position: relative;
        animation: fadeIn 0.3s ease-out;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .user {
        background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        color: white;
        margin-left: auto;
        border-bottom-right-radius: 4px;
      }

      .bot {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: #e2e8f0;
        margin-right: auto;
        border-bottom-left-radius: 4px;
        border: 1px solid #334155;
      }

      .message-icon {
        position: absolute;
        bottom: 8px;
        font-size: 14px;
        opacity: 0.7;
      }

      .user .message-icon {
        right: 12px;
      }

      .bot .message-icon {
        left: 12px;
      }

      #input-container {
        display: flex;
        padding: 14px;
        border-top: 1px solid #1e293b;
        background: #0f172a;
        align-items: center;
      }

      #input {
        flex: 1;
        padding: 14px 18px;
        border-radius: 12px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #f1f5f9;
        font-size: 15px;
        outline: none;
        transition: border-color 0.3s;
      }

      #input:focus {
        border-color: #60a5fa;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
      }

      #input::placeholder {
        color: #64748b;
      }

      #send {
        margin-left: 12px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        padding: 0;
      }

      #send:hover {
        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
        transform: translateY(-1px);
      }

      #send:active {
        transform: translateY(0);
      }

      .send-icon {
        width: 20px;
        height: 20px;
        fill: white;
      }

      .loading-dots {
        display: flex;
        padding: 16px 0;
      }

      .loading-dots .dot {
        width: 10px;
        height: 10px;
        background-color: #94a3b8;
        border-radius: 50%;
        margin: 0 4px;
        animation: bounce 1.5s infinite ease-in-out;
      }

      .loading-dots .dot:nth-child(1) { animation-delay: 0s; }
      .loading-dots .dot:nth-child(2) { animation-delay: 0.2s; }
      .loading-dots .dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Scrollbar styling */
      #chat-container::-webkit-scrollbar {
        width: 8px;
      }

      #chat-container::-webkit-scrollbar-track {
        background: #0d1528;
      }

      #chat-container::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h2><span class="header-icon">⚡</span> AI Development Assistant</h2>
    </div>
    
    <div id="chat-container">
      <div class="welcome-message">
        <div class="welcome-icon">💬</div>
        <h3>How can I assist you today?</h3>
        <p>Ask questions about your code, project structure, or debugging issues.<br>I'm here to help you with your development tasks!</p>
      </div>
    </div>
    
    <div id="input-container">
      <input type="text" id="input" placeholder="Ask about your code or project..." />
      <button id="send">
        <svg class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const chatContainer = document.getElementById('chat-container');
      const input = document.getElementById('input');
      const send = document.getElementById('send');
      let loadingDiv = null;

      function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + sender;
        
        const messageContent = document.createElement('div');
        messageContent.textContent = (sender === 'user' ? "🧑‍💻 " : "🤖 ") + text;
        messageDiv.appendChild(messageContent);
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'message-icon';
        iconSpan.textContent = sender === 'user' ? 'You' : 'Assistant';
        messageDiv.appendChild(iconSpan);
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageDiv;
      }

      function showLoading() {
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-dots';
        
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('div');
          dot.className = 'dot';
          loadingContainer.appendChild(dot);
        }
        
        chatContainer.appendChild(loadingContainer);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return loadingContainer;
      }

      function removeWelcome() {
        const welcome = document.querySelector('.welcome-message');
        if (welcome) {
          welcome.style.display = 'none';
        }
      }

      send.addEventListener('click', sendMessage);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
        }
      });

      function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        
        removeWelcome();
        appendMessage(text, 'user');
        loadingDiv = showLoading();
        
        vscode.postMessage({ command: 'ask', text });
        input.value = '';
      }

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'response') {
          if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
          }
          appendMessage(message.text, 'bot');
        }
      });
    </script>
  </body>
  </html>
  `;
}

module.exports = { activate, deactivate };

// const vscode = require("vscode");
// const cp = require("child_process");
// const path = require("path");
// const fs = require("fs");

// let outputChannel;
// let serverProcess; // ← Track the backend process

// function activate(context) {
//   outputChannel = vscode.window.createOutputChannel("AI Assistant Logs");
//   outputChannel.appendLine("🚀 Activating AI Code Assistant...");
//   outputChannel.show(true);
//   context.subscriptions.push(outputChannel);

//   const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
//   outputChannel.appendLine(`📂 Workspace path: ${workspacePath || "None"}`);

//   if (workspacePath) {
//     const backendPath = path.join(context.extensionPath, "..", "backend");
//     outputChannel.appendLine(`⚙️ Backend path: ${backendPath}`);

//     // find python exe in venv if present
//     const winPython = path.join(backendPath, "venv", "Scripts", "python.exe");
//     const nixPython = path.join(backendPath, "venv", "bin", "python");
//     let pythonExe = "python";
//     if (fs.existsSync(winPython)) pythonExe = winPython;
//     else if (fs.existsSync(nixPython)) pythonExe = nixPython;
//     outputChannel.appendLine(`🐍 Using Python interpreter: ${pythonExe}`);

//     // check files exist
//     if (!fs.existsSync(backendPath)) {
//       outputChannel.appendLine(
//         `❌ Backend directory not found: ${backendPath}`
//       );
//       return vscode.window.showErrorMessage(
//         "AI Assistant: Backend directory not found!"
//       );
//     }
//     const mainPyPath = path.join(backendPath, "main.py");
//     if (!fs.existsSync(mainPyPath)) {
//       outputChannel.appendLine(`❌ main.py not found: ${mainPyPath}`);
//       return vscode.window.showErrorMessage("AI Assistant: main.py not found!");
//     }

//     // 🔁 Shutdown any existing process
//     if (serverProcess && !serverProcess.killed) {
//       outputChannel.appendLine("🛑 Killing previous backend server...");
//       serverProcess.kill();
//     }

//     outputChannel.appendLine("🚀 Starting backend server...");
//     serverProcess = cp.spawn(pythonExe, ["main.py"], {
//       cwd: backendPath,
//       env: {
//         ...process.env,
//         WORKSPACE_PATH: workspacePath,
//         PYTHONIOENCODING: "utf-8",
//         PYTHONUNBUFFERED: "1",
//       },
//       shell: true,
//     });

//     serverProcess.stdout.on("data", (data) => {
//       outputChannel.appendLine(`[Backend] ${data.toString().trim()}`);
//     });
//     serverProcess.stderr.on("data", (data) => {
//       outputChannel.appendLine(`[Backend ERROR] ${data.toString().trim()}`);
//     });
//     serverProcess.on("error", (err) => {
//       outputChannel.appendLine(`❌ Server process error: ${err.message}`);
//       vscode.window.showErrorMessage(
//         `AI Assistant: Failed to start backend - ${err.message}`
//       );
//     });
//     serverProcess.on("exit", (code) => {
//       outputChannel.appendLine(`⚠️ Backend server exited with code ${code}`);
//       if (code !== 0) {
//         vscode.window.showErrorMessage(
//           `AI Assistant: Backend exited with code ${code}`
//         );
//       }
//     });

//     // ensure we kill it on extension deactivate
//     context.subscriptions.push(
//       new vscode.Disposable(() => {
//         if (serverProcess && !serverProcess.killed) {
//           serverProcess.kill();
//           outputChannel.appendLine("🛑 Stopped backend server (on deactivate)");
//         }
//       })
//     );
//   } else {
//     outputChannel.appendLine("⚠️ No workspace folder open");
//     vscode.window.showInformationMessage(
//       "AI Assistant: Please open a folder to activate"
//     );
//   }

//   // Register the ask‐question command
//   const askCmd = vscode.commands.registerCommand(
//     "ai-dev-assistant.askQuestion",
//     () => {
//       const panel = vscode.window.createWebviewPanel(
//         "aiDevAssistant",
//         "AI Assistant Chat",
//         vscode.ViewColumn.One,
//         { enableScripts: true }
//       );
//       panel.webview.html = getWebviewContent();
//       panel.webview.onDidReceiveMessage(async (msg) => {
//         if (msg.command === "ask") {
//           try {
//             const res = await fetch("http://localhost:8000/query", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ question: msg.text }),
//             });
//             const data = await res.json();
//             panel.webview.postMessage({
//               command: "response",
//               text: data.answer,
//             });
//           } catch (err) {
//             panel.webview.postMessage({
//               command: "response",
//               text: `❌ ${err}`,
//             });
//           }
//         }
//       });
//     }
//   );

//   // Optional: show logs on demand
//   const showLogsCmd = vscode.commands.registerCommand(
//     "ai-dev-assistant.showLogs",
//     () => outputChannel.show(true)
//   );

//   context.subscriptions.push(askCmd, showLogsCmd);
// }

// function deactivate() {}

// module.exports = {
//   activate,
//   deactivate,
// };

// without chat-bot
// const vscode = require("vscode");
// const fetch = require("node-fetch");

// function activate(context) {
//   console.log("✅ AI Code Assistant activated!");

//   let disposable = vscode.commands.registerCommand(
//     "ai-dev-assistant.askQuestion",
//     async () => {
//       const question = await vscode.window.showInputBox({
//         prompt: "What do you want to ask the AI assistant?",
//         placeHolder: "e.g., What does watcher.py do?",
//       });

//       if (!question) return;
//       console.log(`📝 User question: ${question}`);

//       const loading = vscode.window.setStatusBarMessage("🧠 Thinking...");

//       try {
//         const res = await fetch("http://localhost:8000/query", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ question }),
//         });

//         const data = await res.json();
//         const answer = data.answer || "⚠️ No answer returned.";
//         console.log(`🤖 AI response: ${answer}`);

//         vscode.window.showInformationMessage(`🤖 ${answer}`, { modal: true });
//       } catch (err) {
//         vscode.window.showErrorMessage(
//           `❌ Failed to contact backend: ${err.message}`
//         );
//       } finally {
//         loading.dispose();
//       }
//     }
//   );

//   context.subscriptions.push(disposable);
// }

// function deactivate() {}

// module.exports = {
//   activate,
//   deactivate,
// };
