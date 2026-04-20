import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { DatabaseAdapter } from '../db/adapter.js';
import { WorkspaceRepo } from '../repositories/workspaces.js';
import { JobRepo } from '../repositories/jobs.js';
import { DocumentRepo } from '../repositories/documents.js';
import type { SavedWorkspace } from '../types/index.js';

const WORKSPACES_DIR = join(homedir(), '.well-tailored', 'workspaces');
const MIGRATED_DIR = join(WORKSPACES_DIR, 'migrated');

export function migrateJsonWorkspaces(db: DatabaseAdapter): number {
  if (!existsSync(WORKSPACES_DIR)) return 0;

  const files = readdirSync(WORKSPACES_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return 0;

  mkdirSync(MIGRATED_DIR, { recursive: true });
  const wsRepo = new WorkspaceRepo(db);
  const jobRepo = new JobRepo(db);
  const docRepo = new DocumentRepo(db);

  let count = 0;
  for (const file of files) {
    const filePath = join(WORKSPACES_DIR, file);
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as SavedWorkspace;
      const snap = raw.snapshot;

      // Skip if a workspace with this name already exists in the DB
      if (wsRepo.findByName(raw.name)) {
        renameSync(filePath, join(MIGRATED_DIR, file));
        count++;
        continue;
      }

      const ws = wsRepo.create({
        name: raw.name,
        sourceResume: snap.documents?.resume ?? null,
        sourceBio: snap.documents?.bio ?? null,
        sourceCoverLetter: snap.documents?.baseCoverLetter ?? null,
        sourceSupplemental: snap.documents?.resumeSupplemental ?? null,
        promptResumeSystem: snap.prompts?.resumeSystem ?? null,
        promptCoverLetterSystem: snap.prompts?.coverLetterSystem ?? null,
        promptScoringSystem: snap.prompts?.scoringSystem ?? null,
        themeJson: snap.theme ? JSON.stringify(snap.theme) : null,
        agentConfigJson: snap.agents ? JSON.stringify(snap.agents) : null,
      });

      for (const job of snap.savedJobs ?? []) {
        const dbJob = jobRepo.create({
          workspaceId: ws.id,
          company: job.company,
          title: job.title,
          jd: job.jd,
          stage: job.stage ?? 'wishlist',
          source: job.source ?? 'manual',
        });
        if (job.result?.output?.resume) {
          docRepo.save({ jobId: dbJob.id, docType: 'resume', markdown: job.result.output.resume });
        }
        if (job.result?.output?.coverLetter) {
          docRepo.save({ jobId: dbJob.id, docType: 'cover', markdown: job.result.output.coverLetter });
        }
      }

      renameSync(filePath, join(MIGRATED_DIR, file));
      count++;
    } catch (err) {
      console.warn(`[migrate] Skipping ${file}: ${(err as Error).message}`);
    }
  }

  if (count > 0) {
    console.log(`[migrate] Migrated ${count} workspace(s) to SQLite. Originals moved to ${MIGRATED_DIR}`);
  }

  return count;
}
