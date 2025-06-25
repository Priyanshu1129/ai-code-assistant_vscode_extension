var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/tree-kill/index.js
var require_tree_kill = __commonJS({
  "node_modules/tree-kill/index.js"(exports2, module2) {
    "use strict";
    var childProcess = require("child_process");
    var spawn = childProcess.spawn;
    var exec = childProcess.exec;
    module2.exports = function(pid, signal, callback) {
      if (typeof signal === "function" && callback === void 0) {
        callback = signal;
        signal = void 0;
      }
      pid = parseInt(pid);
      if (Number.isNaN(pid)) {
        if (callback) {
          return callback(new Error("pid must be a number"));
        } else {
          throw new Error("pid must be a number");
        }
      }
      var tree = {};
      var pidsToProcess = {};
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      switch (process.platform) {
        case "win32":
          exec("taskkill /pid " + pid + " /T /F", callback);
          break;
        case "darwin":
          buildProcessTree(pid, tree, pidsToProcess, function(parentPid) {
            return spawn("pgrep", ["-P", parentPid]);
          }, function() {
            killAll(tree, signal, callback);
          });
          break;
        // case 'sunos':
        //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
        //         killAll(tree, signal, callback);
        //     });
        //     break;
        default:
          buildProcessTree(pid, tree, pidsToProcess, function(parentPid) {
            return spawn("ps", ["-o", "pid", "--no-headers", "--ppid", parentPid]);
          }, function() {
            killAll(tree, signal, callback);
          });
          break;
      }
    };
    function killAll(tree, signal, callback) {
      var killed = {};
      try {
        Object.keys(tree).forEach(function(pid) {
          tree[pid].forEach(function(pidpid) {
            if (!killed[pidpid]) {
              killPid(pidpid, signal);
              killed[pidpid] = 1;
            }
          });
          if (!killed[pid]) {
            killPid(pid, signal);
            killed[pid] = 1;
          }
        });
      } catch (err) {
        if (callback) {
          return callback(err);
        } else {
          throw err;
        }
      }
      if (callback) {
        return callback();
      }
    }
    function killPid(pid, signal) {
      try {
        process.kill(parseInt(pid, 10), signal);
      } catch (err) {
        if (err.code !== "ESRCH") throw err;
      }
    }
    function buildProcessTree(parentPid, tree, pidsToProcess, spawnChildProcessesList, cb) {
      var ps = spawnChildProcessesList(parentPid);
      var allData = "";
      ps.stdout.on("data", function(data) {
        var data = data.toString("ascii");
        allData += data;
      });
      var onClose = function(code) {
        delete pidsToProcess[parentPid];
        if (code != 0) {
          if (Object.keys(pidsToProcess).length == 0) {
            cb();
          }
          return;
        }
        allData.match(/\d+/g).forEach(function(pid) {
          pid = parseInt(pid, 10);
          tree[parentPid].push(pid);
          tree[pid] = [];
          pidsToProcess[pid] = 1;
          buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
        });
      };
      ps.on("close", onClose);
    }
  }
});

// extension.js
var vscode = require("vscode");
var cp = require("child_process");
var path = require("path");
var fs = require("fs");
var treeKill = require_tree_kill();
var outputChannel;
var serverProcess;
var backendPort = null;
var portReady;
function startBackend(workspacePath, context) {
  if (serverProcess && serverProcess.pid) {
    outputChannel.appendLine(`\u{1F6D1} Killing backend PID ${serverProcess.pid}\u2026`);
    treeKill(serverProcess.pid, "SIGKILL", (err) => {
      if (err) outputChannel.appendLine(`\u274C Failed to kill: ${err}`);
      else outputChannel.appendLine(`\u2705 Killed ${serverProcess.pid}`);
    });
  }
  const backendDir = path.join(context.extensionPath, "backend");
  const winPy = path.join(backendDir, "venv", "Scripts", "python.exe");
  const nixPy = path.join(backendDir, "venv", "bin", "python");
  const pythonExe = fs.existsSync(winPy) ? winPy : fs.existsSync(nixPy) ? nixPy : "python";
  outputChannel.appendLine(`\u{1F40D} Using Python: ${pythonExe}`);
  outputChannel.appendLine(`\u{1F680} Starting backend for: ${workspacePath}`);
  const hfKey = vscode.workspace.getConfiguration("aiDevAssistant").get("hfApiKey");
  if (!hfKey) {
    vscode.window.showErrorMessage(
      "AI Dev Assistant: please set aiDevAssistant.hfApiKey in your settings."
    );
    return;
  }
  serverProcess = cp.spawn(pythonExe, ["main.py"], {
    cwd: backendDir,
    env: {
      ...process.env,
      WORKSPACE_PATH: workspacePath,
      HF_API_KEY: hfKey,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1"
    },
    shell: false
  });
  backendPort = null;
  portReady = new Promise((resolve) => {
    const onData = (chunk) => {
      const text = chunk.toString();
      outputChannel.appendLine(`[Backend] ${text.trim()}`);
      for (let line of text.split(/\r?\n/)) {
        line = line.trim();
        if (line.startsWith("PORT::")) {
          backendPort = line.slice("PORT::".length).trim();
          outputChannel.appendLine(
            `\u2705 Backend listening on port ${backendPort}`
          );
          serverProcess.stdout.off("data", onData);
          resolve(backendPort);
          return;
        }
      }
    };
    serverProcess.stdout.on("data", onData);
  });
  serverProcess.stderr.on(
    "data",
    (d) => outputChannel.appendLine(`[Backend ERROR] ${d.toString().trim()}`)
  );
  serverProcess.on("exit", (code) => {
    outputChannel.appendLine(`\u26A0\uFE0F Backend exited with code ${code}`);
    backendPort = null;
  });
}
function activate(context) {
  outputChannel = vscode.window.createOutputChannel("AI Assistant Logs");
  context.subscriptions.push(outputChannel);
  outputChannel.show(true);
  outputChannel.appendLine("\u{1F680} Activating AI Code Assistant\u2026");
  const initialWF = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (initialWF) {
    outputChannel.appendLine(`\u{1F4C2} Initial workspace: ${initialWF}`);
    startBackend(initialWF, context);
  } else {
    outputChannel.appendLine("\u26A0\uFE0F No folder open \u2014 backend not started");
  }
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const next = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (next) {
        outputChannel.appendLine(`\u{1F504} Workspace changed \u2014 now: ${next}`);
        startBackend(next, context);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ai-dev-assistant.askQuestion",
      async () => {
        const port = await Promise.race([
          portReady,
          new Promise((_, rej) => setTimeout(() => rej("timeout"), 1e4))
        ]).catch((e) => {
          vscode.window.showErrorMessage("\u274C Backend didn\u2019t start in time");
          return null;
        });
        if (!port) return;
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
              outputChannel.appendLine(
                `\u{1F4DD} querying http://localhost:${port}/query`
              );
              const res = await fetch(`http://localhost:${port}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: msg.text })
              });
              const data = await res.json();
              panel.webview.postMessage({
                command: "response",
                text: data.answer
              });
            } catch (err) {
              panel.webview.postMessage({
                command: "response",
                text: `\u274C ${err}`
              });
            }
          }
        });
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-dev-assistant.showLogs", () => {
      outputChannel.show(true);
    })
  );
}
function deactivate() {
  if (serverProcess && serverProcess.pid) {
    treeKill(serverProcess.pid, "SIGKILL", (err) => {
      outputChannel.appendLine(
        err ? `\u274C Failed to kill backend: ${err}` : `\u2705 Killed backend PID ${serverProcess.pid}`
      );
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
      <h2><span class="header-icon">\u26A1</span> AI Development Assistant</h2>
    </div>
    
    <div id="chat-container">
      <div class="welcome-message">
        <div class="welcome-icon">\u{1F4AC}</div>
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
        messageContent.textContent = (sender === 'user' ? "\u{1F9D1}\u200D\u{1F4BB} " : "\u{1F916} ") + text;
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
//# sourceMappingURL=extension.js.map
