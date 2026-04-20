import type { Job } from '../types.js';

function normalizedJobPart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function legacyHuntrMatchKey(job: Pick<Job, 'company' | 'title'>): string | null {
  const company = normalizedJobPart(job.company);
  const title = normalizedJobPart(job.title);
  return company && title ? `${company}\u0000${title}` : null;
}
