/** Inputs for tailoring both resume and cover letter. */
export interface TailorInput {
  /** Full text of the base resume (markdown). */
  resume: string;
  /** Full text of the personal bio / background blurb. */
  bio: string;
  /** Company name. */
  company: string;
  /** Job title (optional, inferred from JD if omitted). */
  jobTitle?: string;
  /** Full text of the job description. */
  jobDescription: string;
}

/** Outputs from the tailoring workflow. */
export interface TailorOutput {
  resume: string;
  coverLetter: string;
}

/** Config loaded from env / options. */
export interface Config {
  openaiApiKey: string;
  openaiModel: string;
}

/** Job config from jobs/<slug>/config.yml */
export interface JobConfig {
  company: string;
  title: string;
  description: string;
  url?: string;
  notes?: string;
}

/** Stack profile from stacks/<slug>.yml */
export interface StackProfile {
  name: string;
  technologies: string[];
  emphasis?: string;
}

/** Result for one job or stack processed in a release run */
export interface TailoredResult {
  type: 'job' | 'stack';
  slug: string;
  generatedAt: string;
  skipped?: boolean;
}

/** Summary written to output/release-report.json */
export interface ReleaseReport {
  jobs: TailoredResult[];
  stacks: TailoredResult[];
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
}
