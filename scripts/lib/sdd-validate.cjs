const REQUIRED_FIELDS = ['title', 'slug', 'date', 'status', 'owner', 'tags', 'visibility', 'related'];
const VALID_STATUSES = ['proposal', 'approved', 'in-progress', 'shipped', 'archived'];
const VALID_VISIBILITIES = ['public', 'private'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateFrontmatter(parsed, { knownSlugs } = {}) {
  const errors = [];

  for (const f of REQUIRED_FIELDS) {
    if (!(f in parsed)) errors.push(`missing required field: ${f}`);
  }
  if (errors.length) return errors;

  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') errors.push('title must be a non-empty string');
  if (typeof parsed.slug !== 'string' || !SLUG_PATTERN.test(parsed.slug)) errors.push(`slug must be lowercase kebab-case (got: ${parsed.slug})`);
  if (typeof parsed.date !== 'string' || !ISO_DATE.test(parsed.date)) errors.push(`date must be ISO 8601 YYYY-MM-DD (got: ${parsed.date})`);
  if (!VALID_STATUSES.includes(parsed.status)) errors.push(`status must be one of ${VALID_STATUSES.join(', ')} (got: ${parsed.status})`);
  if (typeof parsed.owner !== 'string' || parsed.owner.trim() === '') errors.push('owner must be a non-empty string');
  if (!Array.isArray(parsed.tags)) errors.push('tags must be an array');
  if (!VALID_VISIBILITIES.includes(parsed.visibility)) errors.push(`visibility must be one of ${VALID_VISIBILITIES.join(', ')} (got: ${parsed.visibility})`);
  if (!Array.isArray(parsed.related)) errors.push('related must be an array');

  if (Array.isArray(parsed.related) && knownSlugs) {
    for (const slug of parsed.related) {
      if (slug === parsed.slug) errors.push(`related[] cannot reference self: ${slug}`);
      else if (!knownSlugs.has(slug)) errors.push(`related slug not found: ${slug}`);
    }
  }

  return errors;
}

const TENANT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateTenant({ slug, name, visibility, ownerUid, members }) {
  const errors = [];
  if (typeof slug !== 'string' || !TENANT_SLUG_PATTERN.test(slug)) {
    errors.push(`slug must be lowercase kebab-case (got: ${slug})`);
  }
  if (slug && (slug.length < 2 || slug.length > 64)) {
    errors.push('slug must be 2-64 characters');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!VALID_VISIBILITIES.includes(visibility)) {
    errors.push(`visibility must be public or private (got: ${visibility})`);
  }
  if (typeof ownerUid !== 'string' || !ownerUid) errors.push('ownerUid is required');
  if (!Array.isArray(members) || members.length === 0) {
    errors.push('members must be a non-empty array');
  }
  return errors;
}

module.exports = {
  REQUIRED_FIELDS,
  VALID_STATUSES,
  VALID_VISIBILITIES,
  ISO_DATE,
  SLUG_PATTERN,
  TENANT_SLUG_PATTERN,
  validateFrontmatter,
  validateTenant
};
