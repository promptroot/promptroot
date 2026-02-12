/**
 * Session Details WebView
 * 
 * Displays detailed information about a Jules session
 */

import * as vscode from 'vscode';
import { JulesSession } from './models';

export class SessionDetailsView {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Show session details
	 */
	show(session: JulesSession): void {
		this.panel = vscode.window.createWebviewPanel(
			'promptroot.sessionDetails',
			`Session: ${session.name || session.sessionId.slice(0, 8)}`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		this.panel.webview.html = this.getHtmlContent(session);

		// Handle messages from webview
		this.panel.webview.onDidReceiveMessage(
			(message) => {
				if (message.command === 'copyUrl') {
					vscode.env.clipboard.writeText(message.url);
					vscode.window.showInformationMessage('URL copied to clipboard');
				} else if (message.command === 'openPR') {
					vscode.env.openExternal(vscode.Uri.parse(message.url));
				} else if (message.command === 'openJules') {
					vscode.env.openExternal(vscode.Uri.parse(message.url));
				}
			},
			undefined,
			this.context.subscriptions
		);

		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	/**
	 * Generate HTML content for session details
	 */
	private getHtmlContent(session: JulesSession): string {
		const statusColor = this.getStatusColor(session.status);
		const createdDate = session.createdAt 
			? new Date(session.createdAt.toMillis()).toLocaleString()
			: 'Unknown';
		const completedDate = session.completedAt
			? new Date(session.completedAt.toMillis()).toLocaleString()
			: 'N/A';

		let prSection = '';
		if (session.pr) {
			prSection = `
				<div class="section">
					<h2>Pull Request</h2>
					<div class="info-grid">
						<div class="info-item">
							<label>Title:</label>
							<span>${this.escapeHtml(session.pr.title)}</span>
						</div>
						${session.pr.number ? `
						<div class="info-item">
							<label>Number:</label>
							<span>#${session.pr.number}</span>
						</div>
						` : ''}
						<div class="info-item">
							<label>URL:</label>
							<a href="#" onclick="openPR('${session.pr.url}')">${this.escapeHtml(session.pr.url)}</a>
						</div>
					</div>
					${session.pr.description ? `
					<div class="description">
						<label>Description:</label>
						<pre>${this.escapeHtml(session.pr.description)}</pre>
					</div>
					` : ''}
					<button onclick="openPR('${session.pr.url}')">Open PR in Browser</button>
				</div>
			`;
		}

		let planSection = '';
		if (session.plan) {
			planSection = `
				<div class="section">
					<h2>Execution Plan</h2>
					<div class="info-item">
						<label>Plan Generated:</label>
						<span>${session.plan.generated ? 'Yes' : 'No'}</span>
					</div>
					${session.plan.stepCount ? `
					<div class="info-item">
						<label>Steps:</label>
						<span>${session.plan.stepCount}</span>
					</div>
					` : ''}
				</div>
			`;
		}

		let failureSection = '';
		if (session.failure) {
			failureSection = `
				<div class="section failure">
					<h2>Failure Information</h2>
					<div class="info-item">
						<label>Reason:</label>
						<span>${this.escapeHtml(session.failure.reason)}</span>
					</div>
					${session.failure.failedStep ? `
					<div class="info-item">
						<label>Failed Step:</label>
						<span>${this.escapeHtml(session.failure.failedStep)}</span>
					</div>
					` : ''}
				</div>
			`;
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Session Details</title>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		h1 {
			font-size: 24px;
			margin-bottom: 8px;
		}
		h2 {
			font-size: 18px;
			margin-top: 0;
			margin-bottom: 16px;
			color: var(--vscode-foreground);
		}
		.section {
			margin-bottom: 24px;
			padding: 16px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			background-color: var(--vscode-editor-background);
		}
		.section.failure {
			border-color: var(--vscode-errorForeground);
			background-color: var(--vscode-inputValidation-errorBackground);
		}
		.status {
			display: inline-block;
			padding: 4px 12px;
			border-radius: 12px;
			font-weight: 500;
			margin-bottom: 20px;
		}
		.info-grid {
			display: grid;
			gap: 12px;
		}
		.info-item {
			display: grid;
			grid-template-columns: 150px 1fr;
			gap: 12px;
		}
		.info-item label {
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
		}
		.description {
			margin-top: 12px;
		}
		.description label {
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
			display: block;
			margin-bottom: 8px;
		}
		.description pre {
			white-space: pre-wrap;
			word-wrap: break-word;
			background-color: var(--vscode-textCodeBlock-background);
			padding: 12px;
			border-radius: 4px;
			margin: 0;
		}
		button {
			padding: 8px 16px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-family: var(--vscode-font-family);
			margin-right: 8px;
			margin-top: 8px;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<h1>${this.escapeHtml(session.name || 'Session')}</h1>
	<div class="status" style="background-color: ${statusColor};">
		${this.getStatusLabel(session.status)}
	</div>

	<div class="section">
		<h2>Overview</h2>
		<div class="info-grid">
			<div class="info-item">
				<label>Session ID:</label>
				<span>${this.escapeHtml(session.sessionId)}</span>
			</div>
			<div class="info-item">
				<label>Prompt:</label>
				<span>${this.escapeHtml(session.promptPath)}</span>
			</div>
			<div class="info-item">
				<label>Source ID:</label>
				<span>${this.escapeHtml(session.sourceId)}</span>
			</div>
			<div class="info-item">
				<label>Branch:</label>
				<span>${this.escapeHtml(session.branch)}</span>
			</div>
			<div class="info-item">
				<label>Created:</label>
				<span>${createdDate}</span>
			</div>
			<div class="info-item">
				<label>Completed:</label>
				<span>${completedDate}</span>
			</div>
		</div>
		<button onclick="openJules('${session.julesUrl}')">View in Jules</button>
		<button onclick="copyUrl('${session.julesUrl}')">Copy Jules URL</button>
	</div>

	${prSection}
	${planSection}
	${failureSection}

	<script>
		const vscode = acquireVsCodeApi();

		function openPR(url) {
			vscode.postMessage({ command: 'openPR', url: url });
		}

		function openJules(url) {
			vscode.postMessage({ command: 'openJules', url: url });
		}

		function copyUrl(url) {
			vscode.postMessage({ command: 'copyUrl', url: url });
		}
	</script>
</body>
</html>`;
	}

	/**
	 * Get status color
	 */
	private getStatusColor(status: string): string {
		switch (status) {
			case 'COMPLETED':
				return 'var(--vscode-testing-iconPassed)';
			case 'FAILED':
				return 'var(--vscode-testing-iconFailed)';
			case 'IN_PROGRESS':
				return 'var(--vscode-progressBar-background)';
			default:
				return 'var(--vscode-badge-background)';
		}
	}

	/**
	 * Get status label
	 */
	private getStatusLabel(status: string): string {
		switch (status) {
			case 'COMPLETED':
				return 'Completed';
			case 'FAILED':
				return 'Failed';
			case 'IN_PROGRESS':
				return 'In Progress';
			case 'PLANNING':
				return 'Planning';
			case 'QUEUED':
				return 'Queued';
			case 'PAUSED':
				return 'Paused';
			default:
				return status;
		}
	}

	/**
	 * Escape HTML special characters
	 */
	private escapeHtml(text: string): string {
		const map: { [key: string]: string } = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, m => map[m]);
	}
}
