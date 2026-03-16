import { DiffHunk, DiffResult } from '../types/index.js';

type DiffLineType = DiffHunk['type'];

interface DiffLine {
  type: DiffLineType;
  line: string;
}

const ANSI_RESET = '\x1b[0m';
const ANSI_COLORS: Record<DiffLineType, string> = {
  added: '\x1b[32m',
  removed: '\x1b[31m',
  unchanged: '\x1b[90m',
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function splitLines(text: string): string[] {
  const normalized = normalizeNewlines(text);
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}

function buildLcsTable(beforeLines: string[], afterLines: string[]): number[][] {
  const table = Array.from({ length: beforeLines.length + 1 }, () =>
    Array.from({ length: afterLines.length + 1 }, () => 0));

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] = beforeLines[beforeIndex] === afterLines[afterIndex]
        ? table[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1]);
    }
  }

  return table;
}

function diffLineSequence(beforeLines: string[], afterLines: string[]): DiffLine[] {
  const table = buildLcsTable(beforeLines, afterLines);
  const lines: DiffLine[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      lines.push({ type: 'unchanged', line: beforeLines[beforeIndex] });
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]) {
      lines.push({ type: 'removed', line: beforeLines[beforeIndex] });
      beforeIndex += 1;
      continue;
    }

    lines.push({ type: 'added', line: afterLines[afterIndex] });
    afterIndex += 1;
  }

  while (beforeIndex < beforeLines.length) {
    lines.push({ type: 'removed', line: beforeLines[beforeIndex] });
    beforeIndex += 1;
  }

  while (afterIndex < afterLines.length) {
    lines.push({ type: 'added', line: afterLines[afterIndex] });
    afterIndex += 1;
  }

  return lines;
}

function mergeIntoHunks(lines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  for (const entry of lines) {
    const previous = hunks.at(-1);
    if (previous && previous.type === entry.type) {
      previous.lines.push(entry.line);
      continue;
    }

    hunks.push({
      type: entry.type,
      lines: [entry.line],
    });
  }

  return hunks;
}

function createStats(hunks: DiffHunk[]): DiffResult['stats'] {
  return hunks.reduce(
    (stats, hunk) => {
      stats[hunk.type] += hunk.lines.length;
      return stats;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );
}

function renderLine(type: DiffLineType, line: string): string {
  const prefix = type === 'added' ? '+' : type === 'removed' ? '-' : ' ';
  return `${ANSI_COLORS[type]}${prefix}${line}${ANSI_RESET}`;
}

function renderMarker(hiddenLineCount: number): string {
  return `${ANSI_COLORS.unchanged} ... ${hiddenLineCount} unchanged lines ...${ANSI_RESET}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUnchangedHunk(
  hunk: DiffHunk,
  index: number,
  hunks: DiffHunk[],
  hasChanges: boolean,
): string[] {
  if (!hasChanges || hunk.lines.length <= 6) {
    return hunk.lines.map((line) => renderLine('unchanged', line));
  }

  const isFirst = index === 0;
  const isLast = index === hunks.length - 1;

  if (isFirst && !isLast) {
    return [
      renderMarker(hunk.lines.length - 3),
      ...hunk.lines.slice(-3).map((line) => renderLine('unchanged', line)),
    ];
  }

  if (!isFirst && isLast) {
    return [
      ...hunk.lines.slice(0, 3).map((line) => renderLine('unchanged', line)),
      renderMarker(hunk.lines.length - 3),
    ];
  }

  return [
    ...hunk.lines.slice(0, 3).map((line) => renderLine('unchanged', line)),
    renderMarker(hunk.lines.length - 6),
    ...hunk.lines.slice(-3).map((line) => renderLine('unchanged', line)),
  ];
}

/** Compute a line-level diff between two strings. */
export function diffLines(before: string, after: string): DiffResult {
  const lines = diffLineSequence(splitLines(before), splitLines(after));
  const hunks = mergeIntoHunks(lines);

  return {
    hunks,
    stats: createStats(hunks),
  };
}

/** Alias kept for markdown-centric call sites. */
export function diffMarkdown(before: string, after: string): DiffResult {
  return diffLines(before, after);
}

/** Format a DiffResult as ANSI-colored terminal output. */
export function formatDiffAnsi(diff: DiffResult): string {
  const hasChanges = diff.hunks.some((hunk) => hunk.type !== 'unchanged');

  return diff.hunks.flatMap((hunk, index, hunks) => {
    if (hunk.type === 'unchanged') {
      return formatUnchangedHunk(hunk, index, hunks, hasChanges);
    }

    return hunk.lines.map((line) => renderLine(hunk.type, line));
  }).join('\n');
}

/** Format a DiffResult as HTML suitable for a workbench panel. */
export function formatDiffHtml(diff: DiffResult): string {
  const lines = diff.hunks.flatMap((hunk) =>
    hunk.lines.map((line) => {
      const prefix = hunk.type === 'added' ? '+' : hunk.type === 'removed' ? '-' : ' ';
      return `<div class="diff-line diff-line--${hunk.type}"><span class="diff-line__prefix">${prefix}</span><span class="diff-line__content">${escapeHtml(line)}</span></div>`;
    }));

  return `<div class="diff-view">${lines.join('')}</div>`;
}
