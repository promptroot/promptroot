import { callFunction } from './api.js';
import { resolveTenantId } from './tenant-resolver.js';

function jsonContent(obj) {
  return [{ type: 'text', text: JSON.stringify(obj, null, 2) }];
}

async function withTenant(args) {
  const tenantId = await resolveTenantId({ explicit: args?.tenantId });
  if (!tenantId) {
    throw new Error('Could not resolve tenantId. Pass tenantId explicitly, add a .promptroot-tenant file to the repo root, or set up the tenant via /wiki/tenants and link your GitHub repo.');
  }
  return tenantId;
}

export const toolDefinitions = [
  {
    name: 'promptroot_search_sdds',
    description: 'Search PromptRoot dev-history wiki SDDs via BM25. Returns ranked chunks with citations. Use before proposing non-trivial architectural changes or when the user references prior decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query.' },
        topK: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
        tenantId: { type: 'string', description: 'Optional. Auto-resolved from .promptroot-tenant or git remote if omitted.' }
      },
      required: ['query']
    },
    handler: async (args) => {
      const payload = { query: args.query, topK: args.topK || 5 };
      const tenantId = args?.tenantId || await resolveTenantId({});
      if (tenantId) payload.tenantId = tenantId;
      const result = await callFunction('ragQuery', payload);
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_list_sdds',
    description: 'List all SDDs visible in a tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string' }
      }
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('listSdds', { tenantId });
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_get_sdd',
    description: 'Fetch the body and frontmatter of a specific SDD. Optionally pinned to a version.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        tenantId: { type: 'string' },
        version: { type: 'string', description: 'Optional version id.' }
      },
      required: ['slug']
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('getSdd', { tenantId, slug: args.slug, version: args.version });
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_create_sdd',
    description: 'Create a new SDD in a tenant. Caller must provide all required frontmatter fields.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
        tenantId: { type: 'string' },
        frontmatter: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            status: { type: 'string', enum: ['proposal', 'approved', 'in-progress', 'shipped', 'archived'] },
            owner: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            related: { type: 'array', items: { type: 'string' } },
            visibility: { type: 'string', enum: ['public', 'private'] }
          },
          required: ['title', 'date', 'status', 'owner', 'tags', 'related', 'visibility']
        },
        body: { type: 'string' },
        changeNote: { type: 'string' }
      },
      required: ['slug', 'frontmatter', 'body']
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('createSdd', {
        tenantId,
        slug: args.slug,
        frontmatter: args.frontmatter,
        body: args.body,
        changeNote: args.changeNote
      });
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_update_sdd',
    description: 'Update an existing SDD. Writes a new version. Slug cannot be changed.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        tenantId: { type: 'string' },
        body: { type: 'string' },
        frontmatter: { type: 'object' },
        changeNote: { type: 'string' }
      },
      required: ['slug']
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('updateSdd', {
        tenantId,
        slug: args.slug,
        body: args.body,
        frontmatter: args.frontmatter,
        changeNote: args.changeNote
      });
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_list_versions',
    description: 'List version history for an SDD.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        tenantId: { type: 'string' }
      },
      required: ['slug']
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('listVersions', { tenantId, slug: args.slug });
      return jsonContent(result);
    }
  },
  {
    name: 'promptroot_restore_version',
    description: 'Roll an SDD back to an earlier version. Writes a new version snapshot — non-destructive.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        tenantId: { type: 'string' },
        versionId: { type: 'string' }
      },
      required: ['slug', 'versionId']
    },
    handler: async (args) => {
      const tenantId = await withTenant(args);
      const result = await callFunction('restoreVersion', { tenantId, slug: args.slug, versionId: args.versionId });
      return jsonContent(result);
    }
  }
];
