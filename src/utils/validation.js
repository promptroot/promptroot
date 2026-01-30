// ===== Validation Functions =====

// GitHub Owner (Username/Organization) Validation
export function validateOwner(owner) {
  if (typeof owner !== 'string' || owner.length < 1 || owner.length > 39) {
    return false;
  }
  // Alphanumeric characters and single hyphens
  // Cannot start or end with a hyphen, and no consecutive hyphens
  const validOwnerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  return validOwnerRegex.test(owner);
}

// GitHub Repository Validation
export function validateRepo(repo) {
  if (typeof repo !== 'string' || repo.length < 1 || repo.length > 100) {
    return false;
  }
  // Alphanumeric characters, hyphens, underscores, and periods
  // Cannot be '.' or '..'
  const validRepoRegex = /^(?!^\.$)(?!^\.\.$)[a-zA-Z0-9_.-]+$/;
  return validRepoRegex.test(repo);
}

// Git Branch Name Validation
export function validateBranch(branch) {
  if (typeof branch !== 'string' || branch.length < 1 || branch.length > 250) {
    return false;
  }

  // Allowlist: alphanumeric, -, _, /
  const validBranchRegex = /^[-a-zA-Z0-9_\/]+$/;
  return validBranchRegex.test(branch);
}

// Path Validation
export function validatePath(path) {
  if (typeof path !== 'string' || path.length < 1) {
    return false;
  }

  // Reject absolute paths
  if (path.startsWith('/')) {
    return false;
  }

  // Reject path traversal
  if (path.includes('..')) {
    return false;
  }

  return true;
}
