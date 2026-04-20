import type { Job, JobListFilter } from '@/types';

const STAGE_ORDER = [
  'wishlist',
  'applied',
  'interview',
  'offer',
  'rejected',
  'timeout',
  'old wishlist',
  'manual',
  'other',
] as const;

const STAGE_LABELS: Record<string, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  timeout: 'Timeout',
  'old wishlist': 'Old Wishlist',
  manual: 'Manual',
  other: 'Other',
};

const STATUS_LIKE_STAGE_VALUES = new Set([
  'loaded',
  'drafted',
  'tailored',
  'reviewed',
  'tailoring',
  'error',
]);

export function normalizeStage(stage: string | null | undefined): string {
  return (stage ?? '').trim().toLowerCase();
}

export function isStatusLikeStage(stage: string | null | undefined): boolean {
  return STATUS_LIKE_STAGE_VALUES.has(normalizeStage(stage));
}

export function getDisplayStage(job: Pick<Job, 'stage'> & { source?: string }): string {
  const normalized = normalizeStage(job.stage);
  if (normalized && !isStatusLikeStage(normalized)) return normalized;
  return normalizeStage(job.source) === 'manual' ? 'manual' : 'other';
}

export function formatStageLabel(stage: string): string {
  const normalized = normalizeStage(stage);
  if (!normalized) return 'Unknown';
  return STAGE_LABELS[normalized] ?? normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getStageFilterValues(jobs: Job[]): JobListFilter[] {
  const uniqueStages = new Set(
    jobs
      .map((job) => getDisplayStage(job))
      .filter(Boolean),
  );

  return [...uniqueStages].sort((left, right) => {
    const leftIndex = STAGE_ORDER.indexOf(left as (typeof STAGE_ORDER)[number]);
    const rightIndex = STAGE_ORDER.indexOf(right as (typeof STAGE_ORDER)[number]);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }) as JobListFilter[];
}

export function matchesJobFilter(job: Job, filter: JobListFilter): boolean {
  return filter === 'all' || getDisplayStage(job) === normalizeStage(filter);
}

export function getStageBadgeClass(stage: string): string {
  const lower = normalizeStage(stage);
  if (lower === 'wishlist' || lower === 'old wishlist') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (lower === 'applied') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (lower === 'interview' || lower === 'interviewing') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (lower === 'offer') return 'bg-green-50 text-green-700 border-green-200';
  if (lower === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (lower === 'timeout') return 'bg-gray-50 text-gray-500 border-gray-200';
  return 'bg-secondary text-muted-foreground border-border';
}
