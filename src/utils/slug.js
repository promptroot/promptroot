// ===== Slug Generation =====

export function slugify(filePath) {
  if (typeof filePath !== 'string') return '';
  const base = filePath.replace(/\.md$/i, '').toLowerCase().replace(/\s+/g, '-');
  return encodeURIComponent(base);
}

export function unslugify(slug) {
  if (typeof slug !== 'string') return '';
  return decodeURIComponent(slug);
}
