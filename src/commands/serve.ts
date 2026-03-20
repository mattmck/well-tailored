import { Command } from 'commander';
import { startWorkbenchServer } from '../server.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Run the local Well-Tailored workbench and API server.')
    .option('-p, --port <port>', 'Port to listen on', '4312')
    .action(async (opts: { port: string }) => {
      const port = parseInt(opts.port, 10);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: "${opts.port}". Must be an integer between 1 and 65535.`);
        process.exit(1);
      }
      const { port: actualPort } = await startWorkbenchServer(port);
      console.log(`Well-Tailored workbench listening on http://localhost:${actualPort}`);
    });
}
