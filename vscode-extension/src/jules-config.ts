import * as vscode from 'vscode';

/**
 * Manager for Jules API configuration and credentials.
 * Uses VS Code SecretStorage for secure key storage.
 */
export class JulesConfig {
  private static readonly SECRET_KEY = 'promptroot.julesApiKey';

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Check if a Jules API key is configured.
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.context.secrets.get(JulesConfig.SECRET_KEY);
    return !!key;
  }

  /**
   * Get the stored Jules API key.
   * Returns null if no key is configured.
   */
  async getApiKey(): Promise<string | null> {
    const key = await this.context.secrets.get(JulesConfig.SECRET_KEY);
    return key || null;
  }

  /**
   * Store a Jules API key in SecretStorage.
   */
  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }
    await this.context.secrets.store(JulesConfig.SECRET_KEY, apiKey.trim());
  }

  /**
   * Remove the stored Jules API key.
   */
  async clearApiKey(): Promise<void> {
    await this.context.secrets.delete(JulesConfig.SECRET_KEY);
  }

  /**
   * Prompt user to enter their Jules API key.
   * Returns true if key was successfully configured.
   */
  async promptForApiKey(): Promise<boolean> {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter your Jules API key',
      password: true,
      placeHolder: 'Enter your API key',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        return null;
      }
    });

    if (!input) {
      return false; // User cancelled
    }

    try {
      await this.setApiKey(input);
      vscode.window.showInformationMessage('Jules API key configured successfully');
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to store API key: ${error}`);
      return false;
    }
  }

  /**
   * Show configuration options to the user.
   */
  async showConfigurationMenu(): Promise<void> {
    const hasKey = await this.hasApiKey();
    
    const options = hasKey
      ? ['View Key Status', 'Update API Key', 'Remove API Key']
      : ['Configure API Key', 'How to Get API Key'];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Jules API Configuration'
    });

    switch (selected) {
      case 'Configure API Key':
      case 'Update API Key': {
        await this.promptForApiKey();
        break;
      }
      
      case 'View Key Status': {
        const key = await this.getApiKey();
        if (key) {
          const masked = '...' + key.substring(key.length - 12);
          vscode.window.showInformationMessage(`Jules API key configured: ${masked}`);
        }
        break;
      }
      
      case 'Remove API Key': {
        const confirm = await vscode.window.showWarningMessage(
          'Remove Jules API key?',
          { modal: true },
          'Remove'
        );
        if (confirm === 'Remove') {
          await this.clearApiKey();
          vscode.window.showInformationMessage('Jules API key removed');
        }
        break;
      }
      
      case 'How to Get API Key': {
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/jessewashburn/prompt-sharing#jules-api-setup')
        );
        break;
      }
    }
  }

  /**
   * Ensure API key is configured. If not, prompt user to configure it.
   * Returns the API key if available, null if user cancelled.
   */
  async ensureApiKey(): Promise<string | null> {
    const key = await this.getApiKey();
    if (key) {
      return key;
    }

    const configure = await vscode.window.showInformationMessage(
      'Jules API key not configured. Would you like to configure it now?',
      'Configure',
      'Cancel'
    );

    if (configure === 'Configure') {
      const success = await this.promptForApiKey();
      if (success) {
        return await this.getApiKey();
      }
    }

    return null;
  }
}
