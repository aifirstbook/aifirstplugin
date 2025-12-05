import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface PromptEntry {
	prompt: string;
	response: string;
	// Optional language id e.g. 'python', 'java' to allow language-scoped matching
	language?: string;
}

export class AIFirstLanguageModelProvider implements vscode.LanguageModelChatProvider {
	private extensionPath: string;
	private promptIndex: PromptEntry[] = [];
	private indexLoaded: boolean = false;

	constructor(extensionPath: string) {
		this.extensionPath = extensionPath;
		this.loadPromptsFromBooks();
	}

	async provideLanguageModelChatInformation(
		options: vscode.PrepareLanguageModelChatModelOptions,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatInformation[]> {
		return [
			{
				id: 'ai-first-book-examples',
				name: 'AI First Book Examples',
				family: 'AIFirst',
				version: '1.0.0',
				maxInputTokens: 4096,
				maxOutputTokens: 2048,
				capabilities: {
					imageInput: false
				}
			}
		];
	}

	async provideLanguageModelChatResponse(
		model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken
	): Promise<void> {
		// Ensure prompts are loaded
		if (!this.indexLoaded) {
			await this.loadPromptsFromBooks();
		}

		// Determine the active editor language (if any) so we can restrict matching
		const activeEditor = vscode.window.activeTextEditor;
		const editorLanguage = activeEditor?.document.languageId;

		// Get the user's message from the messages array
		const userMessages = messages.filter(msg => msg.role === vscode.LanguageModelChatMessageRole.User);
		if (userMessages.length === 0) {
			progress.report(new vscode.LanguageModelTextPart('No user message found in the request.'));
			return;
		}

		const userMessage = userMessages[userMessages.length - 1];
		const userPrompt = this.extractTextFromMessage(userMessage);

		if (!userPrompt) {
			progress.report(new vscode.LanguageModelTextPart('Could not extract text from user message.'));
			return;
		}

		// Find matching prompt, optionally restricted to the active editor language
		const response = this.findMatchingPrompt(userPrompt, editorLanguage);

		// Stream the response
		if (response) {
			// Split response into chunks to simulate streaming
			const chunks = this.splitIntoChunks(response);
			for (const chunk of chunks) {
				if (token.isCancellationRequested) {
					return;
				}
				progress.report(new vscode.LanguageModelTextPart(chunk));
				// Small delay to simulate streaming
				await new Promise(resolve => setTimeout(resolve, 10));
			}
		} else {
			const fallbackMessage = `// I couldn't find a matching example for your prompt. Try checking the AI First Books panel for available examples, or use a prompt from the book content.`;
			progress.report(new vscode.LanguageModelTextPart(fallbackMessage));
		}
	}

	async provideTokenCount(
		model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		token: vscode.CancellationToken
	): Promise<number> {
		// Simple token estimation: approximately 4 characters per token
		const textContent = typeof text === 'string' ? text : this.extractTextFromMessage(text);
		return Math.ceil((textContent?.length || 0) / 4);
	}

	private extractTextFromMessage(message: vscode.LanguageModelChatRequestMessage): string {
		if (typeof message.content === 'string') {
			return message.content;
		}

		if (Array.isArray(message.content)) {
			// Extract text from content parts
			const textParts: string[] = [];
			for (const part of message.content) {
				if (part instanceof vscode.LanguageModelTextPart) {
					textParts.push(part.value);
				}
			}
			return textParts.join(' ');
		}

		return '';
	}

	private async loadPromptsFromBooks(): Promise<void> {
		try {
			this.promptIndex = [];
			const bookContentPath = path.join(this.extensionPath, 'book_content');

			if (!fs.existsSync(bookContentPath)) {
				console.warn('AI First Programming: book_content directory not found:', bookContentPath);
				this.indexLoaded = true;
				return;
			}

			const files = fs.readdirSync(bookContentPath).filter(file => file.endsWith('.json'));

			for (const file of files) {
				try {
					const filePath = path.join(bookContentPath, file);
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const bookData = JSON.parse(fileContent);

					// Derive language from filename when possible (e.g. 'python' or 'java')
					const lowerName = file.toLowerCase();
					let fileLanguage: string | undefined = undefined;
					if (lowerName.includes('python')) {
						fileLanguage = 'python';
					} else if (lowerName.includes('java')) {
						fileLanguage = 'java';
					}

					// Extract prompts from the book structure
					if (bookData.sections && Array.isArray(bookData.sections)) {
						for (const section of bookData.sections) {
							if (section.chapters && Array.isArray(section.chapters)) {
								for (const chapter of section.chapters) {
									if (chapter.examples && Array.isArray(chapter.examples)) {
										for (const example of chapter.examples) {
											// Handle single prompt/response
											if (example.prompt && example.response) {
												const response = Array.isArray(example.response)
													? example.response.join('\n')
													: example.response;
												this.promptIndex.push({
													prompt: example.prompt,
													response: response,
													language: fileLanguage
												});
											}

											// Handle multiple prompts array
											if (example.prompts && Array.isArray(example.prompts)) {
												for (const promptEntry of example.prompts) {
													if (promptEntry.prompt && promptEntry.response) {
														const response = Array.isArray(promptEntry.response)
															? promptEntry.response.join('\n')
															: promptEntry.response;
														this.promptIndex.push({
															prompt: promptEntry.prompt,
															response: response,
															language: fileLanguage
														});
													}
												}
											}
										}
									}
								}
							}
						}
					}
				} catch (error) {
					console.error(`AI First Programming: Error loading book file ${file}:`, error);
				}
			}

			console.log(`AI First Programming: Loaded ${this.promptIndex.length} prompts from book content`);
			this.indexLoaded = true;
		} catch (error) {
			console.error('AI First Programming: Error loading prompts:', error);
			this.indexLoaded = true;
		}
	}

	private findMatchingPrompt(userPrompt: string, language?: string): string | null {
		if (this.promptIndex.length === 0) {
			return null;
		}

		// If a language is provided, restrict to entries that have that language
		let entriesToSearch = this.promptIndex;
		if (language && language !== 'plaintext') {
			entriesToSearch = this.promptIndex.filter(entry => entry.language === language);
			// If there are no entries for that language, return null (do not fall back to other languages)
			if (entriesToSearch.length === 0) {
				return null;
			}
		}

		const normalizedUserPrompt = userPrompt.toLowerCase().trim();

		// 1. Try exact match (case-insensitive)
		for (const entry of entriesToSearch) {
			if (entry.prompt.toLowerCase().trim() === normalizedUserPrompt) {
				return entry.response;
			}
		}

		// 2. Try partial match (user prompt contains stored prompt or vice versa)
		for (const entry of entriesToSearch) {
			const normalizedStoredPrompt = entry.prompt.toLowerCase().trim();
			if (normalizedUserPrompt.includes(normalizedStoredPrompt) ||
				normalizedStoredPrompt.includes(normalizedUserPrompt)) {
				return entry.response;
			}
		}

		// 3. Try fuzzy matching (simple word-based similarity)
		let bestMatch: PromptEntry | null = null;
		let bestScore = 0;
		const userWords = normalizedUserPrompt.split(/\s+/).filter(w => w.length > 2);

		for (const entry of entriesToSearch) {
			const storedWords = entry.prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
			const commonWords = userWords.filter(word => storedWords.includes(word));
			const score = commonWords.length / Math.max(userWords.length, storedWords.length);

			if (score > bestScore && score > 0.5) { // At least 50% word overlap
				bestScore = score;
				bestMatch = entry;
			}
		}

		return bestMatch ? bestMatch.response : null;
	}

	private splitIntoChunks(text: string, chunkSize: number = 50): string[] {
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.substring(i, i + chunkSize));
		}
		return chunks;
	}
}
