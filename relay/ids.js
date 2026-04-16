import { randomBytes } from 'crypto';

export function generateJobId() {
  return `job_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

export function generateRequestId() {
  return `oai_${Date.now()}_${randomBytes(4).toString('hex')}`;
}
