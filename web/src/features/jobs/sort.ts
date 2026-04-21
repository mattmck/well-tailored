import type { Job } from '../../types';

export type SortField = 'company' | 'title' | 'status' | 'listAddedAt';
export type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Job['status'], number> = {
  loaded: 0, tailored: 1, reviewed: 2, tailoring: 3, error: 4,
};

function getAddedTime(job: Job): number | null {
  const time = Date.parse(job.listAddedAt ?? '');
  return Number.isFinite(time) ? time : null;
}

function compareByStableFallback(a: Job, b: Job): number {
  const companyCmp = (a.company ?? '').localeCompare(b.company ?? '');
  if (companyCmp !== 0) return companyCmp;
  return (a.title ?? '').localeCompare(b.title ?? '');
}

function compareByAddedDate(a: Job, b: Job, dir: SortDir): number {
  // Huntr's per-list order (listPosition) is the authoritative "added to this list"
  // signal across stages. `lastMovedAt` only reflects the last stage transition, so
  // for non-wishlist stages it doesn't mean "added to this list" and can be missing
  // entirely. listPosition 0 is the top of Huntr's list (most recently added), so
  // "Added desc" maps to ascending listPosition.
  const aPos = a.listPosition ?? null;
  const bPos = b.listPosition ?? null;
  if (aPos !== null && bPos !== null) {
    if (aPos !== bPos) {
      const posCmp = aPos - bPos;
      return dir === 'desc' ? posCmp : -posCmp;
    }
  } else if (aPos !== null) {
    return -1;
  } else if (bPos !== null) {
    return 1;
  }

  const aTime = getAddedTime(a);
  const bTime = getAddedTime(b);
  if (aTime === null && bTime === null) return compareByStableFallback(a, b);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  const dateCmp = dir === 'asc' ? aTime - bTime : bTime - aTime;
  if (dateCmp !== 0) return dateCmp;

  return compareByStableFallback(a, b);
}

export function sortJobs(jobs: Job[], field: SortField | null, dir: SortDir): Job[] {
  if (!field) return jobs;
  return [...jobs].sort((a, b) => {
    let cmp: number;
    if (field === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else if (field === 'listAddedAt') {
      return compareByAddedDate(a, b, dir);
    } else {
      cmp = (a[field] ?? '').localeCompare(b[field] ?? '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}
