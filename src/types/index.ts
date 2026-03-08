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
  /** Optional base cover letter to use as a style/tone reference. */
  baseCoverLetter?: string;
  /** Optional supplemental resume detail for AI reference (do not reproduce verbatim). */
  resumeSupplemental?: string;
}

/** Outputs from the tailoring workflow. */
export interface TailorOutput {
  resume: string;
  coverLetter: string;
}

/** Config loaded from env / options. */
export interface Config {
  apiKey: string;
  model: string;
}
