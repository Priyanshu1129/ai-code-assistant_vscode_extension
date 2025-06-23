const vscode = require("vscode");
const path = require("path");

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "ai-dev-assistant.askQuestion",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "aiDevAssistant", // internal ID
        "AI Assistant Chat", // tab title
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );

      panel.webview.html = getWebviewContent();

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === "ask") {
          try {
            const response = await fetch("http://localhost:8000/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question: message.text }),
            });

            const data = await response.json();
            panel.webview.postMessage({
              command: "response",
              text: data.answer || "⚠️ No answer",
            });
          } catch (error) {
            panel.webview.postMessage({
              command: "response",
              text: `❌ ${error.message}`,
            });
          }
        }
      });
    }
  );

  context.subscriptions.push(disposable);
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
      }

      body {
        margin: 0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: #0d1117;
        color: #e6f1ff;
      }

      #chat {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: linear-gradient(180deg, #0d1117 0%, #0a1633 100%);
      }

      .message {
        margin: 12px 0;
        padding: 12px 16px;
        border-radius: 10px;
        max-width: 80%;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .user {
        background-color: #2563eb;
        color: #ffffff;
        margin-left: auto;
        text-align: right;
      }

      .bot {
        background-color: #1e3a8a;
        color: #dbeafe;
        margin-right: auto;
        border: 1px solid #3b82f6;
      }

      #input-container {
        display: flex;
        padding: 10px;
        border-top: 1px solid #1f2937;
        background-color: #0a0f1c;
      }

      #input {
        flex: 1;
        padding: 10px 12px;
        border-radius: 8px;
        border: none;
        background-color: #1f2937;
        color: white;
        font-size: 14px;
        outline: none;
      }

      #send {
        margin-left: 10px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background-color: #3b82f6;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      #send:hover {
        background-color: #2563eb;
      }
    </style>
  </head>
  <body>
    <div id="chat"></div>
    <div id="input-container">
      <input type="text" id="input" placeholder="Ask your question..." />
      <button id="send">Send</button>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const chat = document.getElementById('chat');
      const input = document.getElementById('input');
      const send = document.getElementById('send');

function appendMessage(text, sender, isLoading = false) {
  const div = document.createElement('div');
  div.className = 'message ' + sender;

  if (isLoading) {
    div.classList.add('loading');
    div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  } else {
    div.textContent = text;
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
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
        appendMessage("🧑‍💻 " + text, 'user');
        const loadingDiv = appendMessage('', 'bot', true);

        vscode.postMessage({ command: 'ask', text });
        input.value = '';
      }

      window.addEventListener('message', event => {
        const message = event.data;
 if (message.command === 'response') {
  loadingDiv.classList.remove('loading');
  loadingDiv.textContent = "🤖 " + message.text;
}
      });
    </script>
  </body>
  </html>
  `;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

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
