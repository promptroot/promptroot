import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AuthManager } from './auth-manager';
import { COMMANDS } from './constants';

export class DashboardWebviewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;
	private messageDisposable: vscode.Disposable | undefined;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly authManager: AuthManager
	) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this.view = webviewView;
		this.messageDisposable?.dispose();
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);
		this.wireMessages(webviewView);
	}

	public refresh(): void {
		if (!this.view) {
			return;
		}
		this.view.webview.html = this.getHtml(this.view.webview);
	}

	private wireMessages(webviewView: vscode.WebviewView): void {
		this.messageDisposable = webviewView.webview.onDidReceiveMessage(async (message: { command?: string }) => {
			switch (message.command) {
				case 'openDocs':
					await vscode.commands.executeCommand(COMMANDS.openDocs);
					break;
				case 'signIn':
					await vscode.commands.executeCommand(COMMANDS.signIn);
					break;
				case 'signOut':
					await vscode.commands.executeCommand(COMMANDS.signOut);
					break;
				case 'focusQueue':
					await vscode.commands.executeCommand('workbench.view.extension.promptroot');
					await vscode.commands.executeCommand('promptroot.queueView.focus');
					break;
				default:
					break;
			}
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const mediaDir = path.join(this.extensionUri.fsPath, 'media');
		const template = fs.readFileSync(path.join(mediaDir, 'dashboard.html'), 'utf8');

		const cssUri  = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.css'));
		const jsUri   = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.js'));
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.svg'));

		const isSignedIn = this.authManager.isSignedIn();

		const authBadge = isSignedIn
			? '<span class="badge badge--success">&#x25CF; Signed in</span>'
			: '<span class="badge badge--muted">&#x25CB; Not signed in</span>';

		const authButton = isSignedIn
			? '<button class="btn btn--ghost" data-command="signOut">Sign out</button>'
			: '<button class="btn btn--accent" data-command="signIn">Sign in with GitHub</button>';

		const queueButton = isSignedIn
			? '<button class="btn btn--ghost" data-command="focusQueue">Open Jules Queue</button>'
			: '';

		const statusBody = isSignedIn
			? 'You are signed in. Use the views below to manage your Jules queue, sessions, and repositories.'
			: 'Sign in with GitHub to access your Jules queue, session analytics, and repository browser.';

		return template
			.replace(/\{\{CSP_SOURCE\}\}/g, webview.cspSource)
			.replace('{{CSS_URI}}',  cssUri.toString())
			.replace('{{JS_URI}}',   jsUri.toString())
			.replace('{{LOGO_URI}}', logoUri.toString())
			.replace('{{AUTH_BADGE}}',   authBadge)
			.replace('{{AUTH_BUTTON}}',  authButton)
			.replace('{{QUEUE_BUTTON}}', queueButton)
			.replace('{{STATUS_BODY}}',  statusBody);
	}
}
