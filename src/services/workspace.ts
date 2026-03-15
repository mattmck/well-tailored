import { findFile, readFile } from '../lib/files.js';

export interface WorkspacePaths {
  resumePath: string;
  bioPath: string;
  coverLetterPath?: string;
  supplementalPath?: string;
}

export interface WorkspaceDocuments {
  resume: string;
  bio: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
  paths: WorkspacePaths;
}

export interface WorkspaceOverrides {
  resume?: string;
  bio?: string;
  coverLetter?: string;
  supplemental?: string;
}

export function resolveWorkspaceDocuments(
  overrides: WorkspaceOverrides = {},
  cwd?: string,
): WorkspaceDocuments {
  const resumePath = findFile({
    explicit: overrides.resume,
    prefix: 'resume',
    label: 'Resume',
    cwd,
  });
  const bioPath = findFile({
    explicit: overrides.bio,
    prefix: 'bio',
    label: 'Bio',
    cwd,
  });

  let coverLetterPath: string | undefined;
  let baseCoverLetter: string | undefined;
  try {
    coverLetterPath = findFile({
      explicit: overrides.coverLetter,
      prefix: 'cover-letter',
      label: 'Cover letter',
      cwd,
    });
    baseCoverLetter = readFile(coverLetterPath);
  } catch (err) {
    if (overrides.coverLetter) {
      throw new Error(`Failed to load cover letter from "${overrides.coverLetter}": ${(err as Error).message}`);
    }
    coverLetterPath = undefined;
  }

  let supplementalPath: string | undefined;
  let resumeSupplemental: string | undefined;
  try {
    supplementalPath = findFile({
      explicit: overrides.supplemental,
      prefix: 'resume-supplemental',
      label: 'Resume supplemental',
      cwd,
    });
    resumeSupplemental = readFile(supplementalPath);
  } catch (err) {
    if (overrides.supplemental) {
      throw new Error(`Failed to load supplemental from "${overrides.supplemental}": ${(err as Error).message}`);
    }
    supplementalPath = undefined;
  }

  return {
    resume: readFile(resumePath),
    bio: readFile(bioPath),
    baseCoverLetter,
    resumeSupplemental,
    paths: {
      resumePath,
      bioPath,
      coverLetterPath,
      supplementalPath,
    },
  };
}
