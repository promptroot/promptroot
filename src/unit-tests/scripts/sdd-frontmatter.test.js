import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseFrontmatter,
  validate,
  validateAll,
  isUnderPrivateDir,
  listSddFiles
} from '../../../scripts/lib/sdd-frontmatter.js';

const VALID_FM = `---
title: Sample Doc
slug: sample-doc
date: 2026-04-13
status: proposal
owner: jesse
tags: [a, b]
visibility: public
related: []
---

# body
`;

describe('parseFrontmatter', () => {
  it('parses inline array, scalar, and block list forms', () => {
    const fm = parseFrontmatter(`---
title: Test
slug: test
date: 2026-01-01
status: proposal
owner: jesse
tags: [one, two]
visibility: public
related:
  - a
  - b
---
body
`);
    expect(fm.title).toBe('Test');
    expect(fm.tags).toEqual(['one', 'two']);
    expect(fm.related).toEqual(['a', 'b']);
  });

  it('throws on missing frontmatter', () => {
    expect(() => parseFrontmatter('# just a body')).toThrow(/Missing frontmatter/);
  });

  it('throws on unterminated frontmatter', () => {
    expect(() => parseFrontmatter('---\ntitle: foo\nslug: foo\n')).toThrow(/not closed/);
  });

  it('strips quotes from quoted scalars', () => {
    const fm = parseFrontmatter(`---
title: "Quoted Title"
slug: 'single-quoted'
date: 2026-01-01
status: proposal
owner: jesse
tags: []
visibility: public
related: []
---
`);
    expect(fm.title).toBe('Quoted Title');
    expect(fm.slug).toBe('single-quoted');
  });

  it('handles empty inline array', () => {
    const fm = parseFrontmatter(`---
title: T
slug: t
date: 2026-01-01
status: proposal
owner: jesse
tags: []
visibility: public
related: []
---
`);
    expect(fm.tags).toEqual([]);
    expect(fm.related).toEqual([]);
  });
});

describe('validate', () => {
  const baseFm = () => parseFrontmatter(VALID_FM);
  const opts = (overrides = {}) => ({
    filename: 'sample-doc.md',
    isInPrivateDir: false,
    knownSlugs: new Set(['sample-doc']),
    ...overrides
  });

  it('passes on valid frontmatter', () => {
    expect(validate(baseFm(), opts())).toEqual([]);
  });

  it('reports each missing required field', () => {
    const fm = baseFm();
    delete fm.owner;
    delete fm.tags;
    const errs = validate(fm, opts());
    expect(errs).toEqual(expect.arrayContaining([
      'missing required field: owner',
      'missing required field: tags'
    ]));
  });

  it('rejects slug that does not match filename stem', () => {
    const fm = baseFm();
    fm.slug = 'wrong-slug';
    const errs = validate(fm, opts({ knownSlugs: new Set(['wrong-slug']) }));
    expect(errs.some(e => e.includes('does not match filename stem'))).toBe(true);
  });

  it('rejects non-kebab slug', () => {
    const fm = baseFm();
    fm.slug = 'NotKebab';
    const errs = validate(fm, opts({ filename: 'NotKebab.md', knownSlugs: new Set(['NotKebab']) }));
    expect(errs.some(e => e.includes('lowercase kebab-case'))).toBe(true);
  });

  it('rejects non-ISO date', () => {
    const fm = baseFm();
    fm.date = 'April 13, 2026';
    const errs = validate(fm, opts());
    expect(errs.some(e => e.includes('ISO 8601'))).toBe(true);
  });

  it('rejects invalid status', () => {
    const fm = baseFm();
    fm.status = 'wip';
    const errs = validate(fm, opts());
    expect(errs.some(e => e.includes('status must be one of'))).toBe(true);
  });

  it('rejects invalid visibility', () => {
    const fm = baseFm();
    fm.visibility = 'internal';
    const errs = validate(fm, opts());
    expect(errs.some(e => e.includes('visibility must be one of'))).toBe(true);
  });

  it('fails when public file declares visibility: private', () => {
    const fm = baseFm();
    fm.visibility = 'private';
    const errs = validate(fm, opts());
    expect(errs.some(e => e.includes('must live under docs/sdd/private/'))).toBe(true);
  });

  it('fails when private-dir file declares visibility: public', () => {
    const errs = validate(baseFm(), opts({ isInPrivateDir: true }));
    expect(errs.some(e => e.includes('must declare visibility: private'))).toBe(true);
  });

  it('fails on unresolved related slug', () => {
    const fm = baseFm();
    fm.related = ['does-not-exist'];
    const errs = validate(fm, opts());
    expect(errs).toContain('related slug not found: does-not-exist');
  });

  it('fails when related references self', () => {
    const fm = baseFm();
    fm.related = ['sample-doc'];
    const errs = validate(fm, opts());
    expect(errs.some(e => e.includes('cannot reference self'))).toBe(true);
  });
});

describe('validateAll (integration)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sdd-test-'));
    mkdirSync(join(dir, 'private'), { recursive: true });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function write(rel, content) {
    writeFileSync(join(dir, rel), content);
  }

  it('returns no errors for a valid corpus with cross-links', () => {
    write('alpha.md', VALID_FM.replace('sample-doc', 'alpha').replace('Sample Doc', 'Alpha').replace('related: []', 'related: [beta]'));
    write('beta.md', VALID_FM.replace('sample-doc', 'beta').replace('Sample Doc', 'Beta').replace('related: []', 'related: [alpha]'));
    const result = validateAll(dir);
    expect(result.fileCount).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('skips README.md and _template.md', () => {
    write('README.md', '# readme');
    write('_template.md', '# template');
    write('alpha.md', VALID_FM.replace('sample-doc', 'alpha'));
    const files = listSddFiles(dir);
    expect(files.map(f => f.split(/[\\/]/).pop())).toEqual(['alpha.md']);
  });

  it('reports errors per file', () => {
    write('good.md', VALID_FM.replace('sample-doc', 'good'));
    write('bad.md', '# no frontmatter here');
    const result = validateAll(dir);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toMatch(/bad\.md$/);
  });

  it('flags public-content file under private/', () => {
    write('private/leaked.md', VALID_FM.replace('sample-doc', 'leaked'));
    const result = validateAll(dir);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].errors.some(e => e.includes('must declare visibility: private'))).toBe(true);
  });
});

describe('isUnderPrivateDir', () => {
  it('detects private path on posix-style', () => {
    expect(isUnderPrivateDir('/root', '/root/private/secret.md')).toBe(true);
  });

  it('returns false for non-private path', () => {
    expect(isUnderPrivateDir('/root', '/root/public.md')).toBe(false);
  });
});
