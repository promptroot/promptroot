import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a node in the Promptroot assets tree view.
 * This can be a folder, prompt file, or other asset type.
 */
export class PromptrootTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri?: vscode.Uri,
    public readonly itemType: 'folder' | 'prompt' | 'template' | 'root' = 'root',
    public readonly fullPath?: string
  ) {
    super(label, collapsibleState);

    // Set context value for enabling different commands per item type
    this.contextValue = itemType;

    // Set icons based on item type
    this.iconPath = this.getIconForType(itemType);

    // Add tooltip
    this.tooltip = this.getTooltip();

    // Set resource URI for file-based items
    if (resourceUri) {
      this.resourceUri = resourceUri;
      // Allow clicking on files to open them
      if (itemType !== 'folder') {
        this.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [resourceUri]
        };
      }
    }
  }

  /**
   * Get the appropriate icon for the tree item type.
   */
  private getIconForType(itemType: string): vscode.ThemeIcon {
    switch (itemType) {
      case 'folder':
        return new vscode.ThemeIcon('folder');
      case 'prompt':
        return new vscode.ThemeIcon('file-text');
      case 'template':
        return new vscode.ThemeIcon('file-code');
      case 'root':
        return new vscode.ThemeIcon('symbol-folder');
      default:
        return new vscode.ThemeIcon('file');
    }
  }

  /**
   * Generate tooltip text for the tree item.
   */
  private getTooltip(): string {
    switch (this.itemType) {
      case 'folder':
        return `Folder: ${this.label}`;
      case 'prompt':
        return `Prompt: ${this.label}`;
      case 'template':
        return `Template: ${this.label}`;
      case 'root':
        return `Promptroot Assets`;
      default:
        return this.label;
    }
  }
}

/**
 * Tree data provider for Promptroot assets.
 * Manages the tree view hierarchy and provides data for rendering.
 */
export class PromptrootTreeProvider implements vscode.TreeDataProvider<PromptrootTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PromptrootTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<PromptrootTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<PromptrootTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private assetsPath: string | undefined;
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private workspaceRoot: string | undefined) {
    this.detectPromptrootStructure();
    this.setupFileWatcher();
  }

  /**
   * Set up file system watcher to auto-refresh on file changes
   */
  private setupFileWatcher(): void {
    if (!this.workspaceRoot) {
      return;
    }

    // Watch for changes in the prompts directory
    const promptsPattern = new vscode.RelativePattern(this.workspaceRoot, 'prompts/**/*.md');
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(promptsPattern);

    // Refresh on file creation
    this.fileWatcher.onDidCreate(() => {
      this.refresh();
    });

    // Refresh on file deletion
    this.fileWatcher.onDidDelete(() => {
      this.refresh();
    });

    // Refresh on file change
    this.fileWatcher.onDidChange(() => {
      this.refresh();
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }

  /**
   * Detect Promptroot workspace structure by looking for prompts directory.
   */
  private detectPromptrootStructure(): void {
    if (!this.workspaceRoot) {
      return;
    }

    // Check for prompts directory in workspace root
    const promptsDir = path.join(this.workspaceRoot, 'prompts');
    if (fs.existsSync(promptsDir) && fs.statSync(promptsDir).isDirectory()) {
      this.assetsPath = promptsDir;
    } else {
      this.assetsPath = undefined;
    }
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this.detectPromptrootStructure();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the tree item representation for a given element.
   */
  getTreeItem(element: PromptrootTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children for a given element.
   * If no element is provided, return root elements.
   */
  getChildren(element?: PromptrootTreeItem): Thenable<PromptrootTreeItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No workspace folder open. Open a folder to browse Promptroot assets.');
      return Promise.resolve([]);
    }

    if (!this.assetsPath) {
      vscode.window.showWarningMessage('Promptroot structure not detected. Expected a "prompts" directory in workspace root.');
      return Promise.resolve([]);
    }

    if (element && element.fullPath) {
      // Return children for the given element
      return Promise.resolve(this.getDirectoryChildren(element.fullPath));
    } else {
      // Return root-level items (contents of prompts directory)
      return Promise.resolve(this.getDirectoryChildren(this.assetsPath));
    }
  }

  /**
   * Read directory contents and create tree items.
   * Reads actual files and folders from the file system.
   */
  private getDirectoryChildren(dirPath: string): PromptrootTreeItem[] {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }

      const items = fs.readdirSync(dirPath);
      const treeItems: PromptrootTreeItem[] = [];

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Directory
          treeItems.push(new PromptrootTreeItem(
            item,
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(itemPath),
            'folder',
            itemPath
          ));
        } else if (stat.isFile() && this.isPromptrootFile(item)) {
          // File (only show markdown files)
          const itemType = this.getFileType(item);
          treeItems.push(new PromptrootTreeItem(
            item,
            vscode.TreeItemCollapsibleState.None,
            vscode.Uri.file(itemPath),
            itemType,
            itemPath
          ));
        }
      }

      // Sort: directories first, then files, both alphabetically
      treeItems.sort((a, b) => {
        if (a.itemType === 'folder' && b.itemType !== 'folder') {
          return -1;
        }
        if (a.itemType !== 'folder' && b.itemType === 'folder') {
          return 1;
        }
        return a.label.localeCompare(b.label);
      });

      return treeItems;
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading directory: ${error}`);
      return [];
    }
  }

  /**
   * Check if a file should be displayed in the tree.
   * Currently only shows markdown files.
   */
  private isPromptrootFile(filename: string): boolean {
    return filename.endsWith('.md');
  }

  /**
   * Determine the item type based on filename or location.
   * Can be extended to detect templates vs prompts based on directory structure.
   */
  private getFileType(filename: string): 'prompt' | 'template' {
    // Simple heuristic: files in 'templates' directory are templates
    // This can be enhanced with more sophisticated detection
    if (filename.toLowerCase().includes('template')) {
      return 'template';
    }
    return 'prompt';
  }
}
