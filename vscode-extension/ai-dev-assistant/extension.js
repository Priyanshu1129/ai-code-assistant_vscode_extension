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
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      #chat {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background-color: #1e1e1e;
        color: #ddd;
      }
      .message {
        margin: 12px 0;
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .user {
        background-color: #007acc;
        color: white;
        align-self: flex-end;
        margin-left: auto;
      }
      .bot {
        background-color: #2d2d2d;
        border: 1px solid #444;
        align-self: flex-start;
        margin-right: auto;
      }
      #input-container {
        display: flex;
        padding: 12px;
        background-color: #252526;
        border-top: 1px solid #333;
      }
      #input {
        flex: 1;
        padding: 10px 12px;
        border-radius: 8px;
        border: none;
        outline: none;
        font-size: 14px;
        background-color: #1e1e1e;
        color: white;
      }
      #send {
        margin-left: 10px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background-color: #007acc;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      #send:hover {
        background-color: #005f9e;
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

      function appendMessage(text, sender) {
        const div = document.createElement('div');
        div.className = 'message ' + sender;
        div.textContent = text;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
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
        vscode.postMessage({ command: 'ask', text });
        input.value = '';
      }

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'response') {
          appendMessage("🤖 " + message.text, 'bot');
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
