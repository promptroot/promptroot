import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Content Security Policy Configuration', () => {
  it('should have a valid CSP header in firebase.json', () => {
    const firebaseConfigPath = path.resolve(__dirname, '../../firebase.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

    // Find the header for "**" source
    const headers = firebaseConfig.hosting.headers.find(h => h.source === '**');
    expect(headers).toBeDefined();

    const cspHeader = headers.headers.find(h => h.key === 'Content-Security-Policy');
    expect(cspHeader).toBeDefined();

    const csp = cspHeader.value;

    // Directives check
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com");
    // Ensure no unsafe-inline for scripts (unless accompanied by other sources, but strictly looking for 'unsafe-inline' in script-src block is tricky with string matching)
    // We check that script-src doesn't have 'unsafe-inline'.
    // A simple regex check:
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);

    // Connect-src check
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://api.github.com");
    expect(csp).toContain("https://jules.googleapis.com");
    expect(csp).toContain("https://*.googleapis.com");
    expect(csp).toContain("https://*.firebaseio.com");
    expect(csp).toContain("https://runjuleshttp-fjbc67s6eq-uc.a.run.app");
    expect(csp).toContain("https://raw.githubusercontent.com");
    expect(csp).toContain("https://gist.githubusercontent.com");

    // Other directives
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
