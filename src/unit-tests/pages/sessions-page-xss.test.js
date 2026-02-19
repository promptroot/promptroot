import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderAllSessions } from '../../pages/sessions-page.js';

// Mocks
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(),
}));

vi.mock('../../modules/jules-api.js', () => ({
  listJulesSessions: vi.fn(),
  getDecryptedJulesKey: vi.fn(),
}));

vi.mock('../../modules/prompt-viewer.js', () => ({
  attachPromptViewerHandlers: vi.fn(),
  showPromptViewer: vi.fn(),
}));

vi.mock('../../utils/lazy-loaders.js', () => ({
  loadFuse: vi.fn(),
}));

describe('Sessions Page XSS Prevention', () => {
  let container;
  let searchInput;

  beforeEach(() => {
    // Setup DOM
    container = document.createElement('div');
    container.id = 'allSessionsList';
    document.body.appendChild(container);

    searchInput = document.createElement('input');
    searchInput.id = 'sessionSearchInput';
    document.body.appendChild(searchInput);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('should render malicious prompt as text content', async () => {
    const maliciousPrompt = '<img src=x onerror=alert(1)>';
    const sessions = [{
      name: 'projects/p/locations/l/sessions/123',
      createTime: new Date().toISOString(),
      prompt: maliciousPrompt,
      state: 'COMPLETED'
    }];

    await renderAllSessions(sessions);

    const promptDiv = container.querySelector('.session-prompt');
    expect(promptDiv).not.toBeNull();

    // Check that text content matches exactly (which means tags are treated as text)
    expect(promptDiv.textContent).toBe(maliciousPrompt);

    // Check innerHTML to ensure it's escaped (browser handles this when setting textContent)
    expect(promptDiv.innerHTML).toContain('&lt;img');
    expect(promptDiv.innerHTML).not.toContain('<img');

    // Verify no child elements (like img tag)
    expect(promptDiv.children.length).toBe(0);
  });

  it('should render malicious state as text content', async () => {
    const maliciousState = '<script>alert(1)</script>';

    const sessions = [{
      name: 'sessions/123',
      createTime: new Date().toISOString(),
      prompt: 'Safe prompt',
      state: maliciousState
    }];

    await renderAllSessions(sessions);

    const pill = container.querySelector('.session-pill');
    // The state label might be appended after an icon.
    // The implementation appends a text node with ' ' + label.
    expect(pill.textContent).toContain(maliciousState.replace(/_/g, ' '));

    // innerHTML should contain encoded entities
    expect(pill.innerHTML).toContain('&lt;script&gt;');
    expect(pill.innerHTML).not.toContain('<script>');
  });

  it('should render malicious PR URL safely', async () => {
    // Even if href is malicious (e.g. javascript:...), creating an element sets the attribute safely (doesn't break HTML structure)
    // Though javascript: URLs are a separate issue, XSS via injection is prevented.
    const maliciousUrl = '"> <script>alert(1)</script>';
    const sessions = [{
      name: 'sessions/123',
      createTime: new Date().toISOString(),
      prompt: 'Safe prompt',
      state: 'COMPLETED',
      outputs: [{
        pullRequest: {
          url: maliciousUrl
        }
      }]
    }];

    await renderAllSessions(sessions);

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    // It should set href attribute literally
    expect(link.getAttribute('href')).toBe(maliciousUrl);

    // Check that the script tag is not injected into the DOM as an element
    expect(container.querySelector('script')).toBeNull();

    // innerHTML of the link should be just text + icon, no script tag
    expect(link.innerHTML).not.toContain('<script>');
  });
});
