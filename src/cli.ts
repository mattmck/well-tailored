#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerTailorCommand } from './commands/tailor.js';
import { registerHuntrCommand } from './commands/huntr.js';
import { registerServeCommand } from './commands/serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('job-shit')
  .description(
    'Stop suffering. Base resume + company + job description → tailored resume + cover letter, in parallel.',
  )
  .version(getVersion());

registerTailorCommand(program);
registerHuntrCommand(program);
registerServeCommand(program);

program.parse(process.argv);
