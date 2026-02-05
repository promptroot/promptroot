import * as vscode from 'vscode';

/**
 * Jules API Base URL
 */
const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';

/**
 * Default timeout for API requests (10 seconds)
 */
const API_TIMEOUT = 10000;

/**
 * Represents a Jules source (connected repository)
 */
export interface JulesSource {
  name: string;
  displayName: string;
  createTime?: string;
  updateTime?: string;
}

/**
 * Represents a Jules session (coding task)
 */
export interface JulesSession {
  name: string;
  state: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PLANNING' | 'QUEUED' | 'UNKNOWN';
  prompt: string;
  title?: string;
  createTime: string;
  updateTime?: string;
}

/**
 * Response from listJulesSources API
 */
interface ListSourcesResponse {
  sources?: JulesSource[];
  nextPageToken?: string;
}

/**
 * Response from listJulesSessions API
 */
interface ListSessionsResponse {
  sessions?: JulesSession[];
  nextPageToken?: string;
}

/**
 * Client for interacting with the Jules API.
 * Handles authentication, request formatting, and error handling.
 */
export class JulesClient {
  constructor(
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Create headers for Jules API requests.
   */
  private createHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    };
  }

  /**
   * Make a fetch request with timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = API_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your network connection.');
      }
      throw error;
    }
  }

  /**
   * List all Jules sources (connected repositories).
   * @param apiKey - Jules API key
   * @param pageToken - Optional pagination token
   * @returns Promise with sources and next page token
   */
  async listSources(
    apiKey: string,
    pageToken?: string
  ): Promise<ListSourcesResponse> {
    const url = new URL(`${JULES_API_BASE}/sources`);
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    this.outputChannel.appendLine(`Fetching Jules sources from: ${url.toString()}`);

    try {
      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: this.createHeaders(apiKey)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.outputChannel.appendLine(`Error response: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ListSourcesResponse;
      this.outputChannel.appendLine(`Fetched ${data.sources?.length || 0} sources`);
      return data;
    } catch (error) {
      this.outputChannel.appendLine(`Error fetching sources: ${error}`);
      throw error;
    }
  }

  /**
   * List all Jules sessions (coding tasks).
   * @param apiKey - Jules API key
   * @param pageSize - Number of sessions to fetch (default: 10)
   * @param pageToken - Optional pagination token
   * @returns Promise with sessions and next page token
   */
  async listSessions(
    apiKey: string,
    pageSize: number = 10,
    pageToken?: string
  ): Promise<ListSessionsResponse> {
    const url = new URL(`${JULES_API_BASE}/sessions`);
    url.searchParams.set('pageSize', pageSize.toString());
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    this.outputChannel.appendLine(`Fetching Jules sessions from: ${url.toString()}`);

    try {
      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: this.createHeaders(apiKey)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.outputChannel.appendLine(`Error response: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ListSessionsResponse;
      this.outputChannel.appendLine(`Fetched ${data.sessions?.length || 0} sessions`);
      return data;
    } catch (error) {
      this.outputChannel.appendLine(`Error fetching sessions: ${error}`);
      throw error;
    }
  }

  /**
   * Get details for a specific session.
   * @param apiKey - Jules API key
   * @param sessionId - Session identifier (just the ID, not full resource name)
   * @returns Promise with session details
   */
  async getSession(apiKey: string, sessionId: string): Promise<JulesSession> {
    const url = `${JULES_API_BASE}/sessions/${sessionId}`;

    this.outputChannel.appendLine(`Fetching session details from: ${url}`);

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: this.createHeaders(apiKey)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.outputChannel.appendLine(`Error response: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as JulesSession;
      this.outputChannel.appendLine(`Fetched session: ${data.name}`);
      return data;
    } catch (error) {
      this.outputChannel.appendLine(`Error fetching session: ${error}`);
      throw error;
    }
  }

  /**
   * Test API key by attempting to list sources.
   * @param apiKey - Jules API key to test
   * @returns Promise that resolves to true if key is valid
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      await this.listSources(apiKey);
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`API key test failed: ${error}`);
      return false;
    }
  }
}
