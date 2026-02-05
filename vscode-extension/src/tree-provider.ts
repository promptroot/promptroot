import * as vscode from 'vscode';

/**
 * Represents a node in the Promptroot assets tree view.
 * This can be a folder, prompt file, or other asset type.
 */
export class PromptrootTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri?: vscode.Uri,
    public readonly itemType: 'folder' | 'prompt' | 'template' | 'root' = 'root'
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

  constructor(private workspaceRoot: string | undefined) {}

  /**
   * Refresh the tree view.
   */
  refresh(): void {
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
      vscode.window.showInformationMessage('No workspace folder open');
      return Promise.resolve([]);
    }

    if (element) {
      // Return children for the given element (Phase 3 will implement this)
      return Promise.resolve(this.getElementChildren(element));
    } else {
      // Return root-level items (Phase 2: sample data)
      return Promise.resolve(this.getRootElements());
    }
  }

  /**
   * Get root-level tree items.
   * Phase 2: Returns sample/placeholder data.
   * Phase 3: Will read actual workspace structure.
   */
  private getRootElements(): PromptrootTreeItem[] {
    // Sample data for Phase 2 verification
    return [
      new PromptrootTreeItem(
        'prompts',
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        'folder'
      ),
      new PromptrootTreeItem(
        'templates',
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        'folder'
      ),
      new PromptrootTreeItem(
        'sample-prompt.md',
        vscode.TreeItemCollapsibleState.None,
        undefined,
        'prompt'
      )
    ];
  }

  /**
   * Get children for a specific tree element.
   * Phase 2: Returns sample data for demonstration.
   * Phase 3: Will read actual file system.
   */
  private getElementChildren(element: PromptrootTreeItem): PromptrootTreeItem[] {
    // Sample nested data
    if (element.label === 'prompts') {
      return [
        new PromptrootTreeItem(
          'tutorial',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'folder'
        ),
        new PromptrootTreeItem(
          'example-prompt.md',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'prompt'
        )
      ];
    }

    if (element.label === 'templates') {
      return [
        new PromptrootTreeItem(
          'basic-template.md',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'template'
        ),
        new PromptrootTreeItem(
          'advanced-template.md',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'template'
        )
      ];
    }

    if (element.label === 'tutorial') {
      return [
        new PromptrootTreeItem(
          'getting-started.md',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'prompt'
        ),
        new PromptrootTreeItem(
          'advanced-usage.md',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'prompt'
        )
      ];
    }

    return [];
  }
}
