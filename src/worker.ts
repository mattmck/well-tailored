import type { DatabaseAdapter } from './db/adapter.js';
import { TaskRepo } from './repositories/tasks.js';
import { DocumentRepo } from './repositories/documents.js';
import { ScoreRepo } from './repositories/scores.js';
import { GapRepo } from './repositories/gap.js';
import type { PromptOverrides, TailorInput, TailorRunResult } from './types/index.js';

export interface WorkerRunOptions {
  includeScoring?: boolean;
  promptOverrides?: PromptOverrides;
}

export interface WorkerDeps {
  runTailor: (input: TailorInput, agents?: unknown, options?: WorkerRunOptions) => Promise<TailorRunResult>;
}

export interface Worker {
  /** Process the next pending task. Returns true if a task was processed, false if queue was empty. */
  processOne(): Promise<boolean>;
  /** Start a polling loop. Call the returned stop() function to halt. */
  start(intervalMs?: number): { stop: () => void };
}

export function createWorker(db: DatabaseAdapter, deps: WorkerDeps): Worker {
  const taskRepo = new TaskRepo(db);
  const docRepo = new DocumentRepo(db);
  const scoreRepo = new ScoreRepo(db);
  const gapRepo = new GapRepo(db);

  async function processOne(): Promise<boolean> {
    const task = taskRepo.claimNext();
    if (!task) return false;

    console.log(`[worker] starting task ${task.id} type=${task.type} job=${task.jobId}`);

    try {
      if (task.type === 'tailor') {
        const parsed = JSON.parse(task.inputJson) as {
          input?: TailorInput;
          agents?: unknown;
          includeScoring?: boolean;
          promptOverrides?: PromptOverrides;
        } & TailorInput;
        const result = await deps.runTailor(parsed.input ?? parsed, parsed.agents, {
          includeScoring: parsed.includeScoring ?? true,
          promptOverrides: parsed.promptOverrides,
        });

        // Persist markdown documents
        docRepo.save({ jobId: task.jobId, docType: 'resume', markdown: result.output.resume });
        docRepo.save({ jobId: task.jobId, docType: 'cover', markdown: result.output.coverLetter });

        // Persist evaluator scorecard if present
        if (result.scorecard?.evaluator) {
          scoreRepo.create({
            jobId: task.jobId,
            taskId: task.id,
            scorecard: result.scorecard.evaluator,
          });
        }

        // Persist gap analysis if present
        if (result.gapAnalysis) {
          gapRepo.create({
            jobId: task.jobId,
            taskId: task.id,
            analysis: result.gapAnalysis,
          });
        }

        taskRepo.complete(task.id, JSON.stringify(result));
        console.log(`[worker] completed task ${task.id}`);
      } else {
        taskRepo.fail(task.id, `Unknown task type: ${task.type}`);
        console.warn(`[worker] unknown task type: ${task.type} (task ${task.id})`);
      }
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      console.error(`[worker] task ${task.id} failed: ${message}`);
      taskRepo.fail(task.id, message);
    }

    return true;
  }

  function start(intervalMs = 2000): { stop: () => void } {
    let running = true;
    async function loop() {
      while (running) {
        await processOne();
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
    loop().catch(console.error);
    return { stop: () => { running = false; } };
  }

  return { processOne, start };
}
