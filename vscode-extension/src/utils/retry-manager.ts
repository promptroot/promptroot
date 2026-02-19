/**
 * Retry Manager - Handles retry logic with exponential backoff
 */

import * as vscode from 'vscode';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to show progress notifications (default: true) */
  showProgress?: boolean;
  /** Custom error message prefix */
  errorMessagePrefix?: string;
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTime: number;
}

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors are retryable
  if (message.includes('network') || 
      message.includes('fetch') || 
      message.includes('timeout') || 
      message.includes('connection')) {
    return true;
  }
  
  // Rate limit errors are retryable
  if (message.includes('rate limit') || 
      message.includes('too many requests') ||
      message.includes('429')) {
    return true;
  }
  
  // Service unavailable errors are retryable
  if (message.includes('unavailable') || 
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504')) {
    return true;
  }
  
  // Authentication errors are NOT retryable
  if (message.includes('unauthorized') || 
      message.includes('authentication') ||
      message.includes('401') ||
      message.includes('403')) {
    return false;
  }
  
  // Validation errors are NOT retryable
  if (message.includes('invalid') || 
      message.includes('validation') ||
      message.includes('400')) {
    return false;
  }
  
  // Default to retryable for unknown errors
  return true;
}

/**
 * Retry Manager for handling retries with exponential backoff
 */
export class RetryManager {
  private activeRetries: Map<string, AbortController> = new Map();
  
  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      showProgress = true,
      errorMessagePrefix = 'Operation',
      isRetryable = defaultIsRetryable
    } = options;
    
    const startTime = Date.now();
    let attempt = 0;
    let currentDelay = initialDelay;
    let lastError: Error | undefined;
    
    // Create progress notification if requested
    let progressResolve: (() => void) | undefined;
    const progressPromise = showProgress 
      ? new Promise<void>(resolve => { progressResolve = resolve; })
      : Promise.resolve();
    
    if (showProgress) {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${errorMessagePrefix}...`,
        cancellable: false
      }, async (progress) => {
        await progressPromise;
        return;
      });
    }
    
    while (attempt < maxAttempts) {
      attempt++;
      
      try {
        if (showProgress && progressResolve) {
          // Update progress
          const percentage = (attempt / maxAttempts) * 100;
          // Progress API doesn't support direct updates in this pattern
        }
        
        const result = await operation();
        
        // Success!
        if (progressResolve) {
          progressResolve();
        }
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!isRetryable(lastError)) {
          // Not retryable, fail immediately
          if (progressResolve) {
            progressResolve();
          }
          
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: Date.now() - startTime
          };
        }
        
        // Last attempt, fail
        if (attempt >= maxAttempts) {
          if (progressResolve) {
            progressResolve();
          }
          
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: Date.now() - startTime
          };
        }
        
        // Wait before retry with exponential backoff
        await this.delay(Math.min(currentDelay, maxDelay));
        currentDelay *= backoffMultiplier;
      }
    }
    
    // Should never reach here, but TypeScript needs this
    if (progressResolve) {
      progressResolve();
    }
    
    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts: attempt,
      totalTime: Date.now() - startTime
    };
  }
  
  /**
   * Execute multiple operations with retry logic in parallel
   */
  async executeAllWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>[]> {
    const promises = operations.map(op => this.executeWithRetry(op, options));
    return Promise.all(promises);
  }
  
  /**
   * Execute operation with retry and show detailed progress
   */
  async executeWithDetailedProgress<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      isRetryable = defaultIsRetryable
    } = options;
    
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: operationName,
      cancellable: true
    }, async (progress, token) => {
      const startTime = Date.now();
      let attempt = 0;
      let currentDelay = initialDelay;
      let lastError: Error | undefined;
      
      while (attempt < maxAttempts && !token.isCancellationRequested) {
        attempt++;
        
        progress.report({
          message: attempt > 1 
            ? `Attempt ${attempt}/${maxAttempts}...` 
            : 'Processing...',
          increment: (1 / maxAttempts) * 100
        });
        
        try {
          const result = await operation();
          
          progress.report({
            message: 'Success!',
            increment: 100
          });
          
          return {
            success: true,
            data: result,
            attempts: attempt,
            totalTime: Date.now() - startTime
          };
        } catch (error) {
          lastError = error as Error;
          
          // Check if cancelled
          if (token.isCancellationRequested) {
            return {
              success: false,
              error: new Error('Operation cancelled by user'),
              attempts: attempt,
              totalTime: Date.now() - startTime
            };
          }
          
          // Check if error is retryable
          if (!isRetryable(lastError)) {
            progress.report({
              message: 'Failed (not retryable)'
            });
            
            return {
              success: false,
              error: lastError,
              attempts: attempt,
              totalTime: Date.now() - startTime
            };
          }
          
          // Last attempt, fail
          if (attempt >= maxAttempts) {
            progress.report({
              message: `Failed after ${attempt} attempts`
            });
            
            return {
              success: false,
              error: lastError,
              attempts: attempt,
              totalTime: Date.now() - startTime
            };
          }
          
          // Wait before retry
          const delayMs = Math.min(currentDelay, maxDelay);
          progress.report({
            message: `Retrying in ${Math.round(delayMs / 1000)}s...`
          });
          
          await this.delay(delayMs);
          currentDelay *= backoffMultiplier;
        }
      }
      
      // Cancelled or max attempts reached
      return {
        success: false,
        error: lastError || new Error('Operation cancelled or max attempts reached'),
        attempts: attempt,
        totalTime: Date.now() - startTime
      };
    });
  }
  
  /**
   * Cancel all active retries
   */
  cancelAll(): void {
    for (const controller of this.activeRetries.values()) {
      controller.abort();
    }
    this.activeRetries.clear();
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global retry manager instance
 */
export const retryManager = new RetryManager();
