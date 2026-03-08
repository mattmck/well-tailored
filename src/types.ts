/** Configuration for a single job application. Lives at jobs/<slug>/config.yml */
export interface JobConfig {
  /** Display name of the company */
  company: string;
  /** Exact job title from the posting */
  title: string;
  /** Full job description text */
  description: string;
  /** Posting URL (optional, for reference) */
  url?: string;
  /** Any personal notes about why you want this role */
  notes?: string;
}

/** A stack-emphasis profile. Lives at stacks/<slug>.yml */
export interface StackProfile {
  /** Human-readable name, e.g. "AWS / Java" */
  name: string;
  /** Technologies to foreground, e.g. ["AWS", "Lambda", "Java", "Spring Boot"] */
  technologies: string[];
  /** Free-text guidance for the AI on how to emphasise this stack */
  emphasis?: string;
}

/** Everything the AI needs to tailor a resume */
export interface TailoringContext {
  baseResume: string;
  jobConfig?: JobConfig;
  stackProfile?: StackProfile;
}

/** The output produced for one job or stack */
export interface TailoredResult {
  resume: string;
  type: "job" | "stack";
  slug: string;
  generatedAt: string;
}

/** Summary produced at the end of a release run */
export interface ReleaseReport {
  jobs: TailoredResult[];
  stacks: TailoredResult[];
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
}
