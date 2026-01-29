// ===== URL Parameter Parsing =====
import { validateOwner, validateRepo, validateBranch, validatePathParam } from './validation.js';

export function parseParams() {
  const out = {};
  const sources = [
    location.search || "",
    location.hash && location.hash.includes("?")
      ? location.hash.slice(location.hash.indexOf("?"))
      : ""
  ];

  const validationMap = {
    owner: validateOwner,
    repo: validateRepo,
    branch: validateBranch,
    path: validatePathParam
  };

  for (const src of sources) {
    const p = new URLSearchParams(src);
    for (const [k, v] of p.entries()) {
      const key = k.toLowerCase();
      // URLSearchParams values are already decoded.
      const value = v;

      const validator = validationMap[key];
      if (validator) {
        if (validator(value)) {
          out[key] = value;
        } else {
          console.warn(`Invalid value for parameter '${key}':`, value);
        }
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

export function getHashParam(key) {
  const match = location.hash.match(new RegExp(`[#&?]${key}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setHashParam(key, value) {
  const params = new URLSearchParams(location.hash.slice(1));
  params.set(key, value);
  location.hash = params.toString();
}
