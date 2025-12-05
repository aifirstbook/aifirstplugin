import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface BookData {
  title: string;
  sections: Section[];
}

interface Section {
  title: string;
  chapters: Chapter[];
}

interface Chapter {
  title: string;
  goal: string;
  examples: Example[];
}

interface Example {
  title: string;
  description: string;
  prompts: Prompt[];
}

interface Prompt {
  prompt: string;
  response: string;
}

export class AIBookProvider implements vscode.TreeDataProvider<BookItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BookItem | undefined | null | void> = new vscode.EventEmitter<BookItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<BookItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BookItem): Thenable<BookItem[]> {
    if (!element) {
      // Root level - return books
      return Promise.resolve(this.getBooks());
    } else if (element.contextValue === 'book') {
      // Return sections for this book
      return Promise.resolve(this.getSections(element.data as BookData));
    } else if (element.contextValue === 'section') {
      // Return chapters for this section
      return Promise.resolve(this.getChapters(element.data as Section));
    } else if (element.contextValue === 'chapter') {
      // Return topics for this chapter
      return Promise.resolve(this.getExamples(element.data as Chapter));
    }
    return Promise.resolve([]);
  }

  private getBooks(): BookItem[] {
    const books: BookItem[] = [];
    const extensionPath = this.context.extensionPath;
    
    if (!extensionPath) {
      console.error('No extension path found');
      return books;
    }

    const bookContentPath = path.join(extensionPath, 'book_content');
    
    if (!fs.existsSync(bookContentPath)) {
      console.error('Book content path does not exist:', bookContentPath);
      return books;
    }

    const files = fs.readdirSync(bookContentPath).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      try {
        const filePath = path.join(bookContentPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rawBookData = JSON.parse(fileContent);
        const bookData: BookData = this.transformBookData(rawBookData);
        
        const bookItem = new BookItem(
          bookData.title,
          vscode.TreeItemCollapsibleState.Collapsed,
          'book',
          bookData
        );
        bookItem.iconPath = new vscode.ThemeIcon('book');
        bookItem.tooltip = `${bookData.title} - ${bookData.sections.length} sections`;
        books.push(bookItem);
      } catch (error) {
        console.error(`Error loading book file ${file}:`, error);
      }
    }

    return books;
  }

  private transformBookData(rawData: any): BookData {
    return {
      ...rawData,
      sections: rawData.sections.map((section: any) => ({
        ...section,
        chapters: section.chapters.map((chapter: any) => ({
          ...chapter,
          examples: chapter.examples.map((example: any) => {
            // Transform example to ensure it has prompts array
            if (example.prompts) {
              // Already has prompts array - normalize responses
              return {
                title: example.title,
                description: example.description,
                prompts: example.prompts.map((p: any) => ({
                  prompt: p.prompt,
                  response: Array.isArray(p.response) ? p.response.join('\n') : p.response
                }))
              };
            } else if (example.prompt && example.response) {
              // Single prompt case - convert to prompts array
              return {
                title: example.title,
                description: example.description,
                prompts: [{
                  prompt: example.prompt,
                  response: Array.isArray(example.response) ? example.response.join('\n') : example.response
                }]
              };
            } else {
              // Fallback - empty prompts array
              return {
                title: example.title,
                description: example.description || '',
                prompts: []
              };
            }
          })
        }))
      }))
    };
  }

  private getSections(bookData: BookData): BookItem[] {
    return bookData.sections.map(section => {
      const sectionItem = new BookItem(
        section.title,
        vscode.TreeItemCollapsibleState.Expanded,
        'section',
        section
      );
      sectionItem.iconPath = new vscode.ThemeIcon('folder');
      sectionItem.tooltip = `${section.title} - ${section.chapters.length} chapters`;
      return sectionItem;
    });
  }

  private getChapters(sectionData: Section): BookItem[] {
    return sectionData.chapters.map(chapter => {
      const chapterItem = new BookItem(
        chapter.title,
        vscode.TreeItemCollapsibleState.Collapsed,
        'chapter',
        chapter
      );
      chapterItem.iconPath = new vscode.ThemeIcon('file-text');
      chapterItem.tooltip = chapter.goal;
      chapterItem.description = `${chapter.examples.length} topics`;
      return chapterItem;
    });
  }

  private getExamples(chapterData: Chapter): BookItem[] {
    return chapterData.examples.map(example => {
      const exampleItem = new BookItem(
        example.title,
        vscode.TreeItemCollapsibleState.None,
        'example',
        example
      );
      exampleItem.iconPath = new vscode.ThemeIcon('notebook-mimetype');
      exampleItem.tooltip = example.description;
      exampleItem.command = {
        command: 'ai-first-programming.showExample',
        title: 'Show Example',
        arguments: [example]
      };
      return exampleItem;
    });
  }
}

class BookItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly data: any
  ) {
    super(label, collapsibleState);
  }
}