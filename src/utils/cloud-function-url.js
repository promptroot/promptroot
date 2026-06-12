const PROJECT_ID = 'promptroot-b02a2';
const REGION = 'us-central1';

export function cloudFunctionUrl(name) {
  if (typeof window === 'undefined') {
    return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  }
  if (window.location.port === '5000') {
    return `http://${window.location.hostname}:5001/${PROJECT_ID}/${REGION}/${name}`;
  }
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}
