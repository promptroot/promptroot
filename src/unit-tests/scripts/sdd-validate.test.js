import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateFrontmatter, validateTenant } = require('../../../scripts/lib/sdd-validate.cjs');

const goodFm = () => ({
  title: 'A Doc',
  slug: 'a-doc',
  date: '2026-04-26',
  status: 'proposal',
  owner: 'jesse',
  tags: ['rag'],
  related: [],
  visibility: 'public'
});

describe('validateFrontmatter', () => {
  it('passes a valid frontmatter object', () => {
    expect(validateFrontmatter(goodFm())).toEqual([]);
  });

  it('reports missing required fields', () => {
    const fm = goodFm();
    delete fm.title;
    expect(validateFrontmatter(fm)).toContain('missing required field: title');
  });

  it('rejects invalid slug format', () => {
    const fm = { ...goodFm(), slug: 'NotKebab' };
    expect(validateFrontmatter(fm).join(' ')).toMatch(/slug must be lowercase kebab-case/);
  });

  it('rejects invalid date', () => {
    const fm = { ...goodFm(), date: '04/26/2026' };
    expect(validateFrontmatter(fm).join(' ')).toMatch(/date must be ISO 8601/);
  });

  it('rejects unknown status', () => {
    const fm = { ...goodFm(), status: 'wip' };
    expect(validateFrontmatter(fm).join(' ')).toMatch(/status must be one of/);
  });

  it('rejects bad visibility', () => {
    const fm = { ...goodFm(), visibility: 'maybe' };
    expect(validateFrontmatter(fm).join(' ')).toMatch(/visibility must be one of/);
  });

  it('rejects related referencing self', () => {
    const fm = { ...goodFm(), related: ['a-doc'] };
    const knownSlugs = new Set(['a-doc']);
    expect(validateFrontmatter(fm, { knownSlugs }).join(' ')).toMatch(/cannot reference self/);
  });
});

describe('validateTenant', () => {
  const goodTenant = () => ({
    slug: 'planet',
    name: 'Planet',
    visibility: 'private',
    ownerUid: 'uid_abc',
    members: ['uid_abc']
  });

  it('passes a valid tenant', () => {
    expect(validateTenant(goodTenant())).toEqual([]);
  });

  it('rejects bad slug', () => {
    expect(validateTenant({ ...goodTenant(), slug: 'P' }).join(' ')).toMatch(/slug/);
  });

  it('rejects empty name', () => {
    expect(validateTenant({ ...goodTenant(), name: '' }).join(' ')).toMatch(/name is required/);
  });

  it('rejects empty members array', () => {
    expect(validateTenant({ ...goodTenant(), members: [] }).join(' ')).toMatch(/members must be a non-empty array/);
  });

  it('rejects bad visibility', () => {
    expect(validateTenant({ ...goodTenant(), visibility: 'open' }).join(' ')).toMatch(/visibility/);
  });
});
