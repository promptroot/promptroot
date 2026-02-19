import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    PromptAssetMetadata,
    PromptTemplate,
    getAvailableTemplates,
    templateFromLabel,
    generatePromptContent,
    validateAssetName,
    assetNameToFilename,
} from './templates';

/**
 * Collect metadata from user through multi-step input
 */
export async function collectAssetMetadata(outputChannel: vscode.OutputChannel): Promise<PromptAssetMetadata | undefined> {
    outputChannel.appendLine('Starting asset metadata collection...');
    
    // Step 1: Asset name
    const name = await vscode.window.showInputBox({
        prompt: 'Enter prompt asset name',
        placeHolder: 'My Awesome Prompt',
        validateInput: validateAssetName,
    });
    
    if (!name) {
        outputChannel.appendLine('Asset creation cancelled: No name provided');
        return undefined;
    }
    
    // Step 2: Description
    const description = await vscode.window.showInputBox({
        prompt: 'Enter prompt description',
        placeHolder: 'A brief description of what this prompt does',
    });
    
    if (!description) {
        outputChannel.appendLine('Asset creation cancelled: No description provided');
        return undefined;
    }
    
    // Step 3: Category
    const categoryPick = await vscode.window.showQuickPick(
        [
            'General',
            'Development',
            'Documentation',
            'Testing',
            'Tutorial',
            'Other',
        ],
        {
            placeHolder: 'Select a category',
        }
    );
    
    if (!categoryPick) {
        outputChannel.appendLine('Asset creation cancelled: No category selected');
        return undefined;
    }
    
    // Step 4: Author (default to workspace/system username)
    const defaultAuthor = process.env.USER || process.env.USERNAME || 'Unknown';
    const author = await vscode.window.showInputBox({
        prompt: 'Enter author name',
        value: defaultAuthor,
    });
    
    if (!author) {
        outputChannel.appendLine('Asset creation cancelled: No author provided');
        return undefined;
    }
    
    const metadata: PromptAssetMetadata = {
        name: name.trim(),
        description: description.trim(),
        category: categoryPick,
        author: author.trim(),
    };
    
    outputChannel.appendLine(`Collected metadata: ${JSON.stringify(metadata)}`);
    return metadata;
}

/**
 * Select template from available options
 */
export async function selectTemplate(outputChannel: vscode.OutputChannel): Promise<PromptTemplate | undefined> {
    outputChannel.appendLine('Prompting user to select template...');
    
    const templates = getAvailableTemplates();
    const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a prompt template',
    });
    
    if (!selected) {
        outputChannel.appendLine('Asset creation cancelled: No template selected');
        return undefined;
    }
    
    const template = templateFromLabel(selected.label);
    outputChannel.appendLine(`Selected template: ${template}`);
    return template;
}

/**
 * Show confirmation dialog with file preview
 */
export async function confirmFileCreation(
    filename: string,
    content: string,
    outputChannel: vscode.OutputChannel
): Promise<boolean> {
    outputChannel.appendLine(`Showing confirmation dialog for: ${filename}`);
    
    try {
        // Create preview document
        outputChannel.appendLine(`Creating preview document...`);
        const previewUri = vscode.Uri.parse(`untitled:${filename}`);
        const doc = await vscode.workspace.openTextDocument(previewUri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        
        // Insert content into preview
        outputChannel.appendLine(`Inserting content into preview...`);
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), content);
        });
        
        // Show confirmation message
        outputChannel.appendLine(`Showing confirmation dialog...`);
        const choice = await vscode.window.showWarningMessage(
            `Create new file "${filename}"?`,
            { modal: true, detail: 'Preview the content in the editor. Click "Create" to write the file.' },
            'Create',
            'Cancel'
        );
        
        // Revert document to avoid save prompt, then close
        outputChannel.appendLine(`Reverting and closing preview document...`);
        await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
        
        const confirmed = choice === 'Create';
        outputChannel.appendLine(`User ${confirmed ? 'confirmed' : 'cancelled'} file creation`);
        return confirmed;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error in confirmFileCreation: ${message}`);
        throw error;
    }
}

/**
 * Write asset file to disk
 */
export async function writeAssetFile(
    workspacePath: string,
    filename: string,
    content: string,
    outputChannel: vscode.OutputChannel
): Promise<string | undefined> {
    try {
        outputChannel.appendLine(`writeAssetFile called with workspacePath: "${workspacePath}"`);
        outputChannel.appendLine(`writeAssetFile called with filename: "${filename}"`);
        
        const assetsPath = path.join(workspacePath, 'prompts');
        outputChannel.appendLine(`assetsPath computed as: "${assetsPath}"`);
        
        // Ensure prompts directory exists
        if (!fs.existsSync(assetsPath)) {
            outputChannel.appendLine(`Creating prompts directory: ${assetsPath}`);
            fs.mkdirSync(assetsPath, { recursive: true });
        }
        
        const filePath = path.join(assetsPath, filename);
        outputChannel.appendLine(`Final filePath: "${filePath}"`);
        
        // Check if file already exists
        if (fs.existsSync(filePath)) {
            const overwrite = await vscode.window.showWarningMessage(
                `File "${filename}" already exists. Overwrite?`,
                { modal: true },
                'Overwrite',
                'Cancel'
            );
            
            if (overwrite !== 'Overwrite') {
                outputChannel.appendLine('File creation cancelled: File exists and user declined overwrite');
                return undefined;
            }
        }
        
        // Write file
        outputChannel.appendLine(`Writing file: ${filePath}`);
        fs.writeFileSync(filePath, content, 'utf8');
        
        outputChannel.appendLine(`Successfully created: ${filePath}`);
        return filePath;
        
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error writing file: ${message}`);
        vscode.window.showErrorMessage(`Failed to create file: ${message}`);
        return undefined;
    }
}

/**
 * Open newly created file in editor
 */
export async function openFile(filePath: string, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        outputChannel.appendLine(`Opening file: ${filePath}`);
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error opening file: ${message}`);
        // Don't show error to user - file was created successfully
    }
}

/**
 * Main orchestrator for creating a new prompt asset
 */
export async function createNewPromptAsset(
    workspacePath: string,
    outputChannel: vscode.OutputChannel,
    onComplete?: () => void
): Promise<void> {
    outputChannel.appendLine('=== Starting new prompt asset creation ===');
    
    try {
        // Step 1: Select template
        const template = await selectTemplate(outputChannel);
        if (!template) {
            return;
        }
        
        // Step 2: Collect metadata
        const metadata = await collectAssetMetadata(outputChannel);
        if (!metadata) {
            return;
        }
        
        // Step 3: Generate content
        const content = generatePromptContent(template, metadata);
        const filename = assetNameToFilename(metadata.name);
        
        // Step 4: Confirm with preview
        const confirmed = await confirmFileCreation(filename, content, outputChannel);
        if (!confirmed) {
            return;
        }
        
        // Step 5: Write file
        const filePath = await writeAssetFile(workspacePath, filename, content, outputChannel);
        if (!filePath) {
            return;
        }
        
        // Step 6: Open file in editor
        await openFile(filePath, outputChannel);
        
        // Step 7: Notify completion
        vscode.window.showInformationMessage(`Created prompt asset: ${filename}`);
        
        // Step 8: Trigger refresh callback if provided
        if (onComplete) {
            outputChannel.appendLine('Triggering tree refresh callback');
            onComplete();
        }
        
        outputChannel.appendLine('=== Prompt asset creation complete ===');
        
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error during asset creation: ${message}`);
        vscode.window.showErrorMessage(`Failed to create prompt asset: ${message}`);
    }
}
