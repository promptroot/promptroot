import { PROJECT_ID, REGION } from '../app-config.js';

export function cloudFunctionUrl(name) {
  if (typeof window === 'undefined' || !window.location) {
    return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  }
  if (window.location.port === '5000') {
    return `http://${window.location.hostname}:5001/${PROJECT_ID}/${REGION}/${name}`;
  }
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}
