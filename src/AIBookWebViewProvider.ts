import * as vscode from 'vscode';

interface Example {
  title: string;
  description: string;
  prompts: Prompt[];
}

interface Prompt {
  prompt: string;
  response: string;
}

export class AIBookWebViewProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;

  public static showExample(context: vscode.ExtensionContext, example: Example) {
    // Always try to open beside the active editor, or in column 2 if no active editor
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.Two;

    // If we already have a panel, show it instead of creating a new one
    if (AIBookWebViewProvider.currentPanel) {
      AIBookWebViewProvider.currentPanel.reveal(column);
      AIBookWebViewProvider.currentPanel.title = `Example: ${example.title}`;
      AIBookWebViewProvider.currentPanel.webview.html = this.getWebviewContent(example);
      return;
    }

    // Create and show a new webview panel
    AIBookWebViewProvider.currentPanel = vscode.window.createWebviewPanel(
      'aiBookExample',
      `Example: ${example.title}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Set the webview's initial html content
    AIBookWebViewProvider.currentPanel.webview.html = this.getWebviewContent(example);

    // Reset when the current panel is closed
    AIBookWebViewProvider.currentPanel.onDidDispose(
      () => {
        AIBookWebViewProvider.currentPanel = undefined;
      },
      null,
      context.subscriptions
    );
  }

  private static detectLanguage(example: Example): string {
    const title = example.title.toLowerCase();
    const description = example.description.toLowerCase();
    
    // Detect language based on context
    if (title.includes('java') || description.includes('java')) {
      return 'java';
    } else if (title.includes('python') || description.includes('python')) {
      return 'python';
    } else if (title.includes('javascript') || title.includes('js')) {
      return 'javascript';
    } else if (title.includes('typescript') || title.includes('ts')) {
      return 'typescript';
    }
    
    // Default fallback - try to detect from common patterns
    if (example.prompts.length > 0) {
      const firstResponse = example.prompts[0].response.toLowerCase();
      if (firstResponse.includes('print(') || firstResponse.includes('def ') || firstResponse.includes('import ')) {
        return 'python';
      } else if (firstResponse.includes('system.out.println') || firstResponse.includes('public class') || firstResponse.includes('public static')) {
        return 'java';
      } else if (firstResponse.includes('console.log') || firstResponse.includes('function ') || firstResponse.includes('const ') || firstResponse.includes('let ')) {
        return 'javascript';
      }
    }
    
    return 'python'; // Default to python
  }

  private static getWebviewContent(example: Example): string {
    const language = this.detectLanguage(example);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${example.title}</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
            margin: 0;
            padding: 20px;
        }
        
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .title {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin: 0 0 10px 0;
        }
        
        .description {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .prompts-section {
            margin-top: 30px;
        }
        
        .prompts-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: var(--vscode-textLink-foreground);
        }
        
        .prompt-item {
            margin-bottom: 30px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .prompt-header {
            background-color: var(--vscode-panel-background);
            padding: 15px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .prompt-content {
            padding: 15px;
            background-color: var(--vscode-input-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .response-header {
            background-color: var(--vscode-panel-background);
            padding: 15px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .response-content {
            padding: 0;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family);
            overflow-x: auto;
        }
        
        .response-content pre {
            margin: 0;
            padding: 15px;
            background-color: var(--vscode-editor-background) !important;
            border: none;
            border-radius: 0;
        }
        
        .response-content code {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-font-size);
            background: transparent !important;
        }
        

        
        .copy-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            float: right;
            margin-left: 10px;
        }
        
        .copy-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .copy-button:active {
            background-color: var(--vscode-button-secondaryBackground);
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .section-title {
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${this.escapeHtml(example.title)}</div>
        <div class="description">${this.escapeHtml(example.description)}</div>
    </div>
    
    <div class="prompts-section">
        <div class="prompts-title">
            ${example.prompts.length === 1 ? 'Prompt & Response' : `Prompts & Responses (${example.prompts.length} total)`}
        </div>
        
        ${example.prompts.map((prompt, index) => `
            <div class="prompt-item ${example.prompts.length === 1 ? 'single-prompt' : ''}">
                ${example.prompts.length > 1 ? `
                    <div class="prompt-header section-header">
                        <span class="section-title">Prompt ${index + 1}</span>
                        <button class="copy-button" onclick="copyToClipboard('prompt-${index}')">Copy Prompt</button>
                    </div>
                ` : `
                    <div class="prompt-header section-header">
                        <span class="section-title">Prompt</span>
                        <button class="copy-button" onclick="copyToClipboard('prompt-${index}')">Copy Prompt</button>
                    </div>
                `}
                <div class="prompt-content" id="prompt-${index}">${this.escapeHtml(prompt.prompt)}</div>
                <div class="response-header section-header">
                    <span class="section-title">${example.prompts.length > 1 ? `Response ${index + 1}` : 'Response'}</span>
                    <button class="copy-button" onclick="copyToClipboard('response-${index}')">Copy Response</button>
                </div>
                <div class="response-content" id="response-${index}">
                    <pre><code class="language-${language}">${this.escapeHtml(prompt.response)}</code></pre>
                </div>
            </div>
        `).join('')}
    </div>
    
    <script>
        // Initialize syntax highlighting when page loads
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
        });
        
        function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // For response elements, get text from the code element inside
            let text;
            if (elementId.startsWith('response-')) {
                const codeElement = element.querySelector('code');
                text = codeElement ? (codeElement.textContent || codeElement.innerText) : (element.textContent || element.innerText);
            } else {
                text = element.textContent || element.innerText;
            }
            
            // Try modern Clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(function() {
                    showCopyFeedback(elementId);
                }).catch(function(err) {
                    console.error('Failed to copy text: ', err);
                    fallbackCopyTextToClipboard(text, elementId);
                });
            } else {
                // Fallback for older browsers or non-secure contexts
                fallbackCopyTextToClipboard(text, elementId);
            }
        }
        
        function fallbackCopyTextToClipboard(text, elementId) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showCopyFeedback(elementId);
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            
            document.body.removeChild(textArea);
        }
        
        function showCopyFeedback(elementId) {
            const button = document.querySelector(\`button[onclick="copyToClipboard('\${elementId}')"]\`);
            if (button) {
                const originalText = button.textContent;
                button.textContent = '✓ Copied!';
                button.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = 'var(--vscode-button-background)';
                }, 2000);
            }
        }
    </script>
</body>
</html>`;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
} 