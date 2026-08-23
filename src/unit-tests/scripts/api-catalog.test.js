import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('API Catalog (.well-known/api-catalog)', () => {
  const filePath = path.resolve(process.cwd(), '.well-known/api-catalog');

  it('exists and is valid JSON', () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  });

  it('conforms to RFC 9727 and RFC 9264 linkset schema', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(Array.isArray(parsed.linkset)).toBe(true);
    expect(parsed.linkset.length).toBeGreaterThan(0);

    parsed.linkset.forEach(entry => {
      expect(entry.anchor).toBeDefined();
      expect(typeof entry.anchor).toBe('string');
      expect(entry.anchor.startsWith('http://') || entry.anchor.startsWith('https://')).toBe(true);
      expect(entry.title).toBeDefined();

      const hasRelation = entry['service-doc'] || entry['service-desc'] || entry['status'] || entry['item'];
      expect(hasRelation).toBeDefined();
    });
  });

  it('catalogs primary PromptRoot robot endpoints (ragQuery, agentApi, startDeviceAuth)', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const anchors = parsed.linkset.map(e => e.anchor);

    const hasRag = anchors.some(a => a.includes('/ragQuery'));
    const hasAgentApi = anchors.some(a => a.includes('/agentApi'));
    const hasDeviceAuth = anchors.some(a => a.includes('/startDeviceAuth'));

    expect(hasRag).toBe(true);
    expect(hasAgentApi).toBe(true);
    expect(hasDeviceAuth).toBe(true);
  });

  it('contains valid service-doc and service-desc target links', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    parsed.linkset.forEach(entry => {
      ['service-doc', 'service-desc', 'status'].forEach(rel => {
        if (entry[rel]) {
          expect(Array.isArray(entry[rel])).toBe(true);
          entry[rel].forEach(target => {
            expect(target.href).toBeDefined();
            expect(target.href.startsWith('http://') || target.href.startsWith('https://')).toBe(true);
            if (target.type) {
              expect(typeof target.type).toBe('string');
            }
          });
        }
      });
    });
  });
});
