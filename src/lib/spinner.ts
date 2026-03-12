const FRAMES = ['░░░░░', '▓░░░░', '▓▓░░░', '▓▓▓░░', '▓▓▓▓░', '▓▓▓▓▓', '▓▓▓▓░', '▓▓▓░░', '▓▓░░░', '▓░░░░'];

const WORK_MSGS = [
  'grinding out the resume',
  'making you sound employable',
  'begging Claude for mercy',
  'running the tailoring gauntlet',
  'polishing the bullshit',
  'fighting the ATS',
];

const RETRY_MSGS = [
  'rate limited — cooling off',
  'waiting for Claude to notice you',
  'the algo will see you now... maybe',
  'refreshing LinkedIn while we wait',
  'touching grass momentarily',
  "sir, this is a Wendy's",
];

const M = '\x1b[35m'; // magenta
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const R = '\x1b[0m';
const ERASE = '\r\x1b[K';

export interface Spinner {
  stop(): void;
}

function startSpinner(msgs: string[], deadlineMs?: number): Spinner {
  if (!process.stderr.isTTY) {
    if (deadlineMs) {
      process.stderr.write(`  waiting ${Math.ceil((deadlineMs - Date.now()) / 1000)}s before retry...\n`);
    }
    return { stop() {} };
  }

  let frame = 0;
  let msgIdx = 0;

  const tick = () => {
    const bar = FRAMES[frame % FRAMES.length];
    const msg = msgs[msgIdx % msgs.length];
    const suffix = deadlineMs
      ? `  ${BOLD}${Math.ceil(Math.max(0, deadlineMs - Date.now()) / 1000)}s${R}  ${DIM}${msg}${R}`
      : `  ${DIM}${msg}${R}`;
    process.stderr.write(`${ERASE}  ${M}${bar}${R}${suffix}`);
    frame++;
    if (frame % 8 === 0) msgIdx++;
  };

  const id = setInterval(tick, 100);
  tick();
  return {
    stop() {
      clearInterval(id);
      process.stderr.write(ERASE);
    },
  };
}

export async function withSpinner<T>(_label: string, fn: () => Promise<T>): Promise<T> {
  const spinner = startSpinner(WORK_MSGS);
  try {
    return await fn();
  } finally {
    spinner.stop();
  }
}

export function startRetrySpinner(delayMs: number): Spinner {
  return startSpinner(RETRY_MSGS, Date.now() + delayMs);
}
