/**
 * Error Handler
 * 
 * Centralized error handling with categorization, recovery suggestions, and user-friendly messages
 */

import * as vscode from 'vscode';
import { RetryManager, RetryOptions, RetryResult } from './utils/retry-manager';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
	AUTHENTICATION = 'authentication',
	NETWORK = 'network',
	FIRESTORE = 'firestore',
	GITHUB_API = 'github-api',
	JULES_API = 'jules-api',
	FILE_SYSTEM = 'file-system',
	VALIDATION = 'validation',
	CONFIGURATION = 'configuration',
	UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	CRITICAL = 'critical',   // Extension cannot function
	HIGH = 'high',           // Major feature broken
	MEDIUM = 'medium',       // Minor feature issue
	LOW = 'low'              // Cosmetic or non-blocking
}

/**
 * Structured error with metadata
 */
export interface AppError {
	category: ErrorCategory;
	severity: ErrorSeverity;
	message: string;
	originalError?: Error;
	userMessage: string;
	recoverySuggestions: string[];
	actionButtons?: ErrorAction[];
	canRetry: boolean;
	retryDelay?: number; // milliseconds
}

/**
 * Error action button
 */
export interface ErrorAction {
	label: string;
	action: () => void | Promise<void>;
}

/**
 * Error handler service
 */
export class ErrorHandler {
	private errorLog: AppError[] = [];
	private readonly MAX_LOG_SIZE = 100;
	private retryManager: RetryManager;

	constructor(
		private readonly outputChannel: vscode.OutputChannel
	) {
		this.retryManager = new RetryManager();
	}

	/**
	 * Handle and display error to user
	 */
	public async handleError(error: Error | AppError, context?: string): Promise<void> {
		const appError = this.isAppError(error) ? error : this.categorizeError(error);
		
		// Log error
		this.logError(appError, context);
		
		// Show user notification
		await this.showErrorNotification(appError);
	}

	/**
	 * Categorize a raw error into an AppError
	 */
	public categorizeError(error: Error): AppError {
		const message = error.message.toLowerCase();
		
		// Authentication errors
		if (message.includes('unauthorized') || 
		    message.includes('authentication') || 
		    message.includes('token') ||
		    message.includes('401')) {
			return {
				category: ErrorCategory.AUTHENTICATION,
				severity: ErrorSeverity.HIGH,
				message: error.message,
				originalError: error,
				userMessage: 'Authentication failed. Please sign in again.',
				recoverySuggestions: [
					'Sign out and sign in again',
					'Check your internet connection',
					'Verify your GitHub account has not been suspended'
				],
				actionButtons: [{
					label: 'Sign In',
					action: async () => {
						await vscode.commands.executeCommand('promptroot.signIn');
					}
				}],
				canRetry: true,
				retryDelay: 1000
			};
		}
		
		// Network errors
		if (message.includes('network') || 
		    message.includes('fetch') || 
		    message.includes('connection') ||
		    message.includes('timeout') ||
		    message.includes('enotfound') ||
		    message.includes('econnrefused')) {
			return {
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				message: error.message,
				originalError: error,
				userMessage: 'Network connection failed.',
				recoverySuggestions: [
					'Check your internet connection',
					'Verify firewall settings',
					'Try again in a few moments',
					'Check if the service is down'
				],
				canRetry: true,
				retryDelay: 3000
			};
		}
		
		// Firestore errors
		if (message.includes('firestore') || 
		    message.includes('permission-denied') ||
		    message.includes('unavailable')) {
			return {
				category: ErrorCategory.FIRESTORE,
				severity: ErrorSeverity.HIGH,
				message: error.message,
				originalError: error,
				userMessage: 'Database operation failed.',
				recoverySuggestions: [
					'Check your internet connection',
					'Verify you are signed in',
					'Try again in a few moments',
					'Check Firestore service status'
				],
				canRetry: true,
				retryDelay: 2000
			};
		}
		
		// GitHub API errors
		if (message.includes('github') || 
		    message.includes('api.github.com') ||
		    message.includes('403') && message.includes('rate limit')) {
			const isRateLimit = message.includes('rate limit');
			return {
				category: ErrorCategory.GITHUB_API,
				severity: isRateLimit ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
				message: error.message,
				originalError: error,
				userMessage: isRateLimit 
					? 'GitHub API rate limit exceeded.' 
					: 'GitHub API request failed.',
				recoverySuggestions: isRateLimit ? [
					'Wait for the rate limit to reset',
					'Authenticate to increase rate limit',
					'Reduce the frequency of requests'
				] : [
					'Check your internet connection',
					'Verify repository access permissions',
					'Try again in a few moments'
				],
				canRetry: !isRateLimit,
				retryDelay: 5000
			};
		}
		
		// Jules API errors
		if (message.includes('jules') || 
		    message.includes('generativelanguage.googleapis.com')) {
			return {
				category: ErrorCategory.JULES_API,
				severity: ErrorSeverity.HIGH,
				message: error.message,
				originalError: error,
				userMessage: 'Jules API request failed.',
				recoverySuggestions: [
					'Verify your API key is correct',
					'Check internet connection',
					'Verify Google Cloud service status',
					'Try again in a few moments'
				],
				actionButtons: [{
					label: 'Configure API',
					action: async () => {
						await vscode.commands.executeCommand('promptroot.configureJulesApi');
					}
				}],
				canRetry: true,
				retryDelay: 2000
			};
		}
		
		// File system errors
		if (message.includes('enoent') || 
		    message.includes('file') || 
		    message.includes('directory') ||
		    message.includes('eacces')) {
			return {
				category: ErrorCategory.FILE_SYSTEM,
				severity: ErrorSeverity.MEDIUM,
				message: error.message,
				originalError: error,
				userMessage: 'File operation failed.',
				recoverySuggestions: [
					'Check file/folder permissions',
					'Verify the path exists',
					'Close any programs using the file',
					'Try running VS Code as administrator (if needed)'
				],
				canRetry: false
			};
		}
		
		// Validation errors
		if (message.includes('invalid') || 
		    message.includes('validation') ||
		    message.includes('required')) {
			return {
				category: ErrorCategory.VALIDATION,
				severity: ErrorSeverity.LOW,
				message: error.message,
				originalError: error,
				userMessage: 'Invalid input or configuration.',
				recoverySuggestions: [
					'Check the input format',
					'Review the required fields',
					'Consult the documentation'
				],
				canRetry: false
			};
		}
		
		// Unknown errors
		return {
			category: ErrorCategory.UNKNOWN,
			severity: ErrorSeverity.MEDIUM,
			message: error.message,
			originalError: error,
			userMessage: 'An unexpected error occurred.',
			recoverySuggestions: [
				'Try the operation again',
				'Reload the VS Code window',
				'Check the output logs for details',
				'Report this issue if it persists'
			],
			actionButtons: [{
				label: 'View Logs',
				action: () => this.outputChannel.show()
			}],
			canRetry: true,
			retryDelay: 1000
		};
	}

	/**
	 * Show error notification with recovery actions
	 */
	private async showErrorNotification(error: AppError): Promise<void> {
		const actions = error.actionButtons?.map(btn => btn.label) || [];
		
		// Add retry button if applicable
		if (error.canRetry && !actions.includes('Retry')) {
			actions.unshift('Retry');
		}
		
		// Add view logs option
		if (!actions.includes('View Logs')) {
			actions.push('View Logs');
		}
		
		// Show notification based on severity
		const showFunc = error.severity === ErrorSeverity.CRITICAL 
			? vscode.window.showErrorMessage
			: error.severity === ErrorSeverity.HIGH
				? vscode.window.showErrorMessage
				: vscode.window.showWarningMessage;
		
		const selected = await showFunc(
			error.userMessage,
			...actions
		);
		
		// Handle action selection
		if (selected === 'View Logs') {
			this.outputChannel.show();
		} else if (selected === 'Retry') {
			// Return indication that retry was requested
			// Caller should handle retry logic
		} else if (selected) {
			// Execute custom action
			const action = error.actionButtons?.find(btn => btn.label === selected);
			if (action) {
				try {
					await action.action();
				} catch (err) {
					this.outputChannel.appendLine(`Action '${selected}' failed: ${err}`);
				}
			}
		}
	}

	/**
	 * Log error to output channel and internal log
	 */
	private logError(error: AppError, context?: string): void {
		// Add to internal log
		this.errorLog.push(error);
		if (this.errorLog.length > this.MAX_LOG_SIZE) {
			this.errorLog.shift();
		}
		
		// Log to output channel
		const timestamp = new Date().toISOString();
		this.outputChannel.appendLine(`\n[${timestamp}] ERROR (${error.category}/${error.severity})`);
		if (context) {
			this.outputChannel.appendLine(`Context: ${context}`);
		}
		this.outputChannel.appendLine(`Message: ${error.message}`);
		if (error.originalError?.stack) {
			this.outputChannel.appendLine(`Stack: ${error.originalError.stack}`);
		}
		this.outputChannel.appendLine(`User Message: ${error.userMessage}`);
		this.outputChannel.appendLine(`Recovery Suggestions:`);
		error.recoverySuggestions.forEach((suggestion, i) => {
			this.outputChannel.appendLine(`  ${i + 1}. ${suggestion}`);
		});
	}

	/**
	 * Get recent errors
	 */
	public getRecentErrors(count: number = 10): AppError[] {
		return this.errorLog.slice(-count);
	}

	/**
	 * Get errors by category
	 */
	public getErrorsByCategory(category: ErrorCategory): AppError[] {
		return this.errorLog.filter(e => e.category === category);
	}

	/**
	 * Clear error log
	 */
	public clearLog(): void {
		this.errorLog = [];
		this.outputChannel.appendLine('\n[Error log cleared]');
	}
	
	/**
	 * Execute operation with automatic retry and error handling
	 */
	public async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		options?: RetryOptions
	): Promise<T> {
		const result = await this.retryManager.executeWithDetailedProgress(
			operation,
			operationName,
			options
		);
		
		if (!result.success) {
			// Operation failed even after retries
			await this.handleError(result.error!, operationName);
			throw result.error;
		}
		
		// Log successful retry if attempts > 1
		if (result.attempts > 1) {
			this.outputChannel.appendLine(
				`[${operationName}] Succeeded after ${result.attempts} attempts (${result.totalTime}ms)`
			);
		}
		
		return result.data!;
	}
	
	/**
	 * Execute operation with retry and custom error categorization
	 */
	public async executeWithRetryAndCategory<T>(
		operation: () => Promise<T>,
		operationName: string,
		errorCategory: ErrorCategory,
		options?: RetryOptions
	): Promise<T> {
		try {
			return await this.executeWithRetry(operation, operationName, options);
		} catch (error) {
			// Customize error category
			const appError = this.categorizeError(error as Error);
			appError.category = errorCategory;
			await this.handleError(appError, operationName);
			throw error;
		}
	}
	
	/**
	 * Build retry options from AppError
	 */
	public buildRetryOptions(appError: AppError): RetryOptions {
		return {
			maxAttempts: appError.canRetry ? 3 : 1,
			initialDelay: appError.retryDelay || 1000,
			showProgress: true,
			isRetryable: () => appError.canRetry
		};
	}

	/**
	 * Check if error is AppError
	 */
	private isAppError(error: Error | AppError): error is AppError {
		return 'category' in error && 'severity' in error;
	}

	/**
	 * Create error report for troubleshooting
	 */
	public generateErrorReport(): string {
		const report: string[] = [
			'Promptroot Extension - Error Report',
			'=====================================',
			`Generated: ${new Date().toISOString()}`,
			`Total Errors: ${this.errorLog.length}`,
			'',
			'Error Summary by Category:',
			...Object.values(ErrorCategory).map(cat => {
				const count = this.errorLog.filter(e => e.category === cat).length;
				return `  ${cat}: ${count}`;
			}),
			'',
			'Recent Errors (last 10):',
			...this.errorLog.slice(-10).map((err, i) => {
				return [
					`\n${i + 1}. [${err.category}/${err.severity}] ${err.message}`,
					`   User Message: ${err.userMessage}`,
					`   Can Retry: ${err.canRetry}`
				].join('\n');
			})
		];
		
		return report.join('\n');
	}
}
