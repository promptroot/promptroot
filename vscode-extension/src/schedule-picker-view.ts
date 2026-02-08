/**
 * Schedule Picker WebView
 * 
 * Provides date/time/timezone picker for scheduling queue items
 */

import * as vscode from 'vscode';
import { Timestamp } from 'firebase/firestore';

export class SchedulePickerView {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Show schedule picker
	 */
	async show(defaultTimezone?: string): Promise<{ scheduledAt: Date; timezone: string } | undefined> {
		return new Promise((resolve) => {
			this.panel = vscode.window.createWebviewPanel(
				'promptroot.schedulePicker',
				'Schedule Queue Item',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			this.panel.webview.html = this.getHtmlContent(defaultTimezone || 'America/Los_Angeles');

			// Handle messages from webview
			this.panel.webview.onDidReceiveMessage(
				(message) => {
					if (message.command === 'schedule') {
						const scheduledDate = new Date(message.datetime);
						resolve({
							scheduledAt: scheduledDate,
							timezone: message.timezone
						});
						this.panel?.dispose();
					} else if (message.command === 'cancel') {
						resolve(undefined);
						this.panel?.dispose();
					}
				},
				undefined,
				this.context.subscriptions
			);

			this.panel.onDidDispose(() => {
				resolve(undefined);
				this.panel = undefined;
			});
		});
	}

	/**
	 * Generate HTML content for schedule picker
	 */
	private getHtmlContent(defaultTimezone: string): string {
		const commonTimezones = [
			'America/Los_Angeles',
			'America/Denver',
			'America/Chicago',
			'America/New_York',
			'Europe/London',
			'Europe/Paris',
			'Europe/Berlin',
			'Asia/Tokyo',
			'Asia/Shanghai',
			'Asia/Dubai',
			'Australia/Sydney',
			'Pacific/Auckland',
			'UTC'
		];

		const timezoneOptions = commonTimezones
			.map(tz => `<option value="${tz}" ${tz === defaultTimezone ? 'selected' : ''}>${tz.replace(/_/g, ' ')}</option>`)
			.join('\\n');

		// Get current date/time in ISO format for datetime-local input
		const now = new Date();
		const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
			.toISOString()
			.slice(0, 16);

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Schedule Queue Item</title>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		.container {
			max-width: 600px;
			margin: 0 auto;
		}
		h1 {
			color: var(--vscode-foreground);
			margin-bottom: 10px;
		}
		.description {
			color: var(--vscode-descriptionForeground);
			margin-bottom: 30px;
			font-size: 0.9em;
		}
		.form-group {
			margin-bottom: 20px;
		}
		label {
			display: block;
			margin-bottom: 8px;
			font-weight: 600;
			color: var(--vscode-foreground);
		}
		input[type="datetime-local"],
		select {
			width: 100%;
			padding: 8px;
			font-size: 14px;
			font-family: var(--vscode-font-family);
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
		}
		input[type="datetime-local"]:focus,
		select:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: -1px;
		}
		.button-group {
			display: flex;
			gap: 10px;
			margin-top: 30px;
		}
		button {
			padding: 10px 20px;
			font-size: 14px;
			font-family: var(--vscode-font-family);
			border: none;
			border-radius: 2px;
			cursor: pointer;
		}
		.primary-button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.primary-button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		.secondary-button {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.secondary-button:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.preview {
			margin-top: 20px;
			padding: 15px;
			background-color: var(--vscode-textBlockQuote-background);
			border-left: 4px solid var(--vscode-textBlockQuote-border);
			border-radius: 2px;
		}
		.preview-label {
			font-weight: 600;
			margin-bottom: 5px;
			color: var(--vscode-foreground);
		}
		.preview-value {
			color: var(--vscode-descriptionForeground);
			font-size: 0.95em;
		}
		.hint {
			margin-top: 8px;
			font-size: 0.85em;
			color: var(--vscode-descriptionForeground);
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>⏰ Schedule Queue Item</h1>
		<p class="description">Choose when this queue item should be automatically activated and executed.</p>
		
		<form id="scheduleForm">
			<div class="form-group">
				<label for="datetime">Schedule Date & Time</label>
				<input type="datetime-local" id="datetime" name="datetime" value="${localDatetime}" required>
				<div class="hint">Select the date and time when this item should run</div>
			</div>

			<div class="form-group">
				<label for="timezone">Timezone</label>
				<select id="timezone" name="timezone" required>
					${timezoneOptions}
				</select>
				<div class="hint">All times will be displayed in this timezone</div>
			</div>

			<div class="preview">
				<div class="preview-label">Scheduled For:</div>
				<div class="preview-value" id="preview">-</div>
			</div>

			<div class="button-group">
				<button type="submit" class="primary-button">Schedule</button>
				<button type="button" class="secondary-button" onclick="cancel()">Cancel</button>
			</div>
		</form>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const form = document.getElementById('scheduleForm');
		const datetimeInput = document.getElementById('datetime');
		const timezoneSelect = document.getElementById('timezone');
		const preview = document.getElementById('preview');

		// Update preview when inputs change
		function updatePreview() {
			const datetime = datetimeInput.value;
			const timezone = timezoneSelect.value;
			
			if (datetime) {
				const date = new Date(datetime);
				const options = {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: timezone
				};
				
				try {
					preview.textContent = date.toLocaleString('en-US', options) + ' (' + timezone.replace(/_/g, ' ') + ')';
				} catch (e) {
					preview.textContent = date.toLocaleString() + ' (' + timezone.replace(/_/g, ' ') + ')';
				}
			}
		}

		datetimeInput.addEventListener('change', updatePreview);
		timezoneSelect.addEventListener('change', updatePreview);

		// Initialize preview
		updatePreview();

		// Handle form submission
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const datetime = datetimeInput.value;
			const timezone = timezoneSelect.value;

			if (!datetime) {
				return;
			}

			vscode.postMessage({
				command: 'schedule',
				datetime: datetime,
				timezone: timezone
			});
		});

		function cancel() {
			vscode.postMessage({
				command: 'cancel'
			});
		}
	</script>
</body>
</html>`;
	}

	/**
	 * Dispose resources
	 */
	dispose() {
		this.panel?.dispose();
	}
}
