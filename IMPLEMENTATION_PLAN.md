# AIFirst Language Model Chat Provider - Implementation Plan

## Overview
This feature adds an AIFirst Language Model Chat Provider to the extension that looks up prompts from JSON files in the `book_content` directory and returns the corresponding response code. The provider will be automatically installed and enabled for use in all VS Code contexts (inline chat, completion, chat, agent mode, etc.).

## Architecture

### Components

1. **AIFirstLanguageModelProvider** (`src/AIFirstLanguageModelProvider.ts`)
   - Implements `vscode.LanguageModelChatProvider` interface
   - Loads and indexes prompts from JSON files in `book_content` directory
   - Matches user input to stored prompts (exact match or fuzzy matching)
   - Returns the corresponding response code
   - Handles token counting and streaming responses

2. **Prompt Indexer** (within AIFirstLanguageModelProvider)
   - Loads all JSON files from `book_content` directory
   - Extracts prompts and responses from the nested structure
   - Creates an index for fast lookup
   - Handles both single prompt and multiple prompts per example

3. **Extension Registration**
   - Add `languageModelChatProviders` contribution to `package.json`
   - Register provider in `extension.ts` activation function
   - Ensure proper activation events

## Implementation Details

### 1. AIFirstLanguageModelProvider Class

**Key Methods:**
- `provideLanguageModelChatInformation()`: Returns model information
- `provideLanguageModelChatResponse()`: Handles chat requests, matches prompts, returns responses
- `provideTokenCount()`: Estimates token count for given text
- `loadPromptsFromBooks()`: Loads and indexes all prompts from JSON files
- `findMatchingPrompt()`: Matches user input to stored prompts

**Prompt Matching Strategy:**
- Exact match (case-insensitive)
- Partial match (if user input contains the stored prompt)
- Fuzzy matching fallback (using string similarity)

### 2. JSON Structure Handling

The provider will handle the existing JSON structure:
- Books contain sections
- Sections contain chapters
- Chapters contain examples
- Examples can have:
  - Single `prompt` and `response` fields
  - Multiple `prompts` array with `prompt` and `response` fields
- Responses can be strings or arrays (will be joined with newlines)

### 3. Package.json Contributions

```json
{
  "contributes": {
    "languageModelChatProviders": [
      {
        "vendor": "aifirst",
        "displayName": "AIFirst Book Examples"
      }
    ]
  }
}
```

### 4. Extension Activation

- Register provider using `vscode.lm.registerLanguageModelChatProvider()`
- Load prompts on activation
- Handle errors gracefully

### 5. Response Format

- When a matching prompt is found: return the stored response code
- When no match is found: return a helpful message suggesting the user check the AI First Books panel
- Stream responses to match VS Code's expected format

## File Structure

```
src/
  ├── AIFirstLanguageModelProvider.ts  (NEW)
  ├── extension.ts                      (MODIFY)
  └── ...

book_content/
  ├── ai-first-java-programming.json
  └── ai-first-python-programming.json
```

## Testing Considerations

1. Test exact prompt matching
2. Test partial prompt matching
3. Test with prompts that have multiple responses
4. Test error handling (missing files, invalid JSON)
5. Verify provider appears in VS Code's language model selection
6. Test in different contexts (inline chat, chat panel, agent mode)

## Future Enhancements

- Add configuration for matching sensitivity
- Support for prompt variations/synonyms
- Caching mechanism for better performance
- Support for context-aware matching (based on current file language)

