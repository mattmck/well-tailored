import { describe, expect, it } from 'vitest';
import { diffLines, diffMarkdown, formatDiffAnsi, formatDiffHtml } from '../src/lib/diff.js';

describe('diffLines', () => {
  it('returns a single unchanged hunk for identical documents', () => {
    const diff = diffLines('alpha\nbeta\ngamma', 'alpha\nbeta\ngamma');

    expect(diff).toEqual({
      hunks: [
        {
          type: 'unchanged',
          lines: ['alpha', 'beta', 'gamma'],
        },
      ],
      stats: { added: 0, removed: 0, unchanged: 3 },
    });
  });

  it('returns removed and added hunks for completely different documents', () => {
    const diff = diffLines('alpha\nbeta', 'gamma\ndelta');

    expect(diff.hunks).toEqual([
      { type: 'removed', lines: ['alpha', 'beta'] },
      { type: 'added', lines: ['gamma', 'delta'] },
    ]);
    expect(diff.stats).toEqual({ added: 2, removed: 2, unchanged: 0 });
  });

  it('captures a single line change with surrounding context', () => {
    const diff = diffMarkdown('alpha\nbeta\ngamma', 'alpha\nbeta updated\ngamma');

    expect(diff.hunks).toEqual([
      { type: 'unchanged', lines: ['alpha'] },
      { type: 'removed', lines: ['beta'] },
      { type: 'added', lines: ['beta updated'] },
      { type: 'unchanged', lines: ['gamma'] },
    ]);
  });

  it('captures lines added at the end', () => {
    const diff = diffLines('alpha\nbeta', 'alpha\nbeta\ngamma');

    expect(diff.hunks).toEqual([
      { type: 'unchanged', lines: ['alpha', 'beta'] },
      { type: 'added', lines: ['gamma'] },
    ]);
  });

  it('captures lines removed from the middle', () => {
    const diff = diffLines('alpha\nbeta\ngamma\ndelta', 'alpha\ndelta');

    expect(diff.hunks).toEqual([
      { type: 'unchanged', lines: ['alpha'] },
      { type: 'removed', lines: ['beta', 'gamma'] },
      { type: 'unchanged', lines: ['delta'] },
    ]);
  });

  it('handles empty inputs', () => {
    expect(diffLines('', '')).toEqual({
      hunks: [],
      stats: { added: 0, removed: 0, unchanged: 0 },
    });

    expect(diffLines('', 'alpha\nbeta')).toEqual({
      hunks: [{ type: 'added', lines: ['alpha', 'beta'] }],
      stats: { added: 2, removed: 0, unchanged: 0 },
    });

    expect(diffLines('alpha\nbeta', '')).toEqual({
      hunks: [{ type: 'removed', lines: ['alpha', 'beta'] }],
      stats: { added: 0, removed: 2, unchanged: 0 },
    });
  });
});

describe('formatDiffAnsi', () => {
  it('includes the expected color codes and prefixes', () => {
    const diff = diffLines('alpha\nbeta', 'alpha\ngamma');
    const output = formatDiffAnsi(diff);

    expect(output).toContain('\x1b[90m alpha\x1b[0m');
    expect(output).toContain('\x1b[31m-beta\x1b[0m');
    expect(output).toContain('\x1b[32m+gamma\x1b[0m');
  });

  it('collapses long unchanged context blocks', () => {
    const before = [
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      'old line',
      'line 11',
      'line 12',
      'line 13',
      'line 14',
      'line 15',
      'line 16',
      'line 17',
      'line 18',
      'line 19',
      'line 20',
    ].join('\n');
    const after = before.replace('old line', 'new line');
    const output = formatDiffAnsi(diffLines(before, after));

    expect(output).toContain('... 7 unchanged lines ...');
    expect(output).toContain(' line 8');
    expect(output).toContain(' line 10');
    expect(output).toContain(' line 11');
    expect(output).toContain(' line 13');
    expect(output).not.toContain('\x1b[90m line 1\x1b[0m');
    expect(output).not.toContain('\x1b[90m line 20\x1b[0m');
  });

  it('renders HTML with escaped line content', () => {
    const html = formatDiffHtml(diffLines('alpha', '<script>alert(1)</script>'));

    expect(html).toContain('diff-line--removed');
    expect(html).toContain('diff-line--added');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
