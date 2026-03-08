import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { tailorResume } from "./ai.js";
import type {
  JobConfig,
  StackProfile,
  TailoredResult,
  ReleaseReport,
} from "./types.js";

export interface ReleaseOptions {
  dryRun?: boolean;
  resumePath?: string;
  jobsDir?: string;
  stacksDir?: string;
  outputDir?: string;
  /** If set, only process this one job slug */
  job?: string;
  /** If set, only process this one stack slug */
  stack?: string;
}

export async function release(opts: ReleaseOptions = {}): Promise<ReleaseReport> {
  const {
    dryRun = false,
    resumePath = process.env.RESUME_PATH ?? "resume/base.md",
    jobsDir = process.env.JOBS_DIR ?? "jobs",
    stacksDir = process.env.STACKS_DIR ?? "stacks",
    outputDir = process.env.OUTPUT_DIR ?? "output",
    job: onlyJob,
    stack: onlyStack,
  } = opts;

  const startedAt = new Date().toISOString();

  const baseResume = await fs.readFile(resumePath, "utf-8");
  console.log(`📄  Loaded base resume from ${resumePath}`);

  const jobResults = await processJobs({
    baseResume,
    jobsDir,
    outputDir,
    dryRun,
    onlySlug: onlyJob,
  });

  const stackResults = await processStacks({
    baseResume,
    stacksDir,
    outputDir,
    dryRun,
    onlySlug: onlyStack,
  });

  const finishedAt = new Date().toISOString();

  const report: ReleaseReport = {
    jobs: jobResults,
    stacks: stackResults,
    dryRun,
    startedAt,
    finishedAt,
  };

  if (!dryRun) {
    const reportPath = path.join(outputDir, "release-report.json");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊  Release report written to ${reportPath}`);
  }

  console.log(
    `\n✅  Done — ${jobResults.length} job resume(s), ${stackResults.length} stack resume(s) generated.`
  );
  return report;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function processJobs(args: {
  baseResume: string;
  jobsDir: string;
  outputDir: string;
  dryRun: boolean;
  onlySlug?: string;
}): Promise<TailoredResult[]> {
  const { baseResume, jobsDir, outputDir, dryRun, onlySlug } = args;

  const slugs = await readDirSlugs(jobsDir, onlySlug);
  slugs.sort();
  if (slugs.length === 0) {
    console.log("ℹ️   No job configs found — skipping job tailoring.");
    return [];
  }

  const results: TailoredResult[] = [];

  for (const slug of slugs) {
    const configPath = path.join(jobsDir, slug, "config.yml");

    let rawConfig: unknown;
    try {
      rawConfig = yaml.load(await fs.readFile(configPath, "utf-8"));
    } catch {
      console.warn(`⚠️   Skipping ${slug}: could not read ${configPath}`);
      continue;
    }

    if (!rawConfig || typeof rawConfig !== "object") {
      console.warn(
        `⚠️   Skipping ${slug}: job config in ${configPath} is not an object`
      );
      continue;
    }

    const maybeConfig = rawConfig as { [key: string]: unknown };
    if (typeof maybeConfig.company !== "string" || typeof maybeConfig.title !== "string") {
      console.warn(
        `⚠️   Skipping ${slug}: job config in ${configPath} is missing required 'company' or 'title' fields`
      );
      continue;
    }

    const config = rawConfig as JobConfig;

    console.log(`\n🎯  [job] ${config.company} — ${config.title}`);

    if (dryRun) {
      console.log("     (dry-run, skipping AI call)");
      results.push(makeDryResult("job", slug));
      continue;
    }

    const resume = await tailorResume({ baseResume, jobConfig: config });
    const result = makeResult("job", slug, resume);
    results.push(result);

    const outDir = path.join(outputDir, "jobs", slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "resume.md"), resume);
    console.log(`     ✏️   Written to ${path.join(outDir, "resume.md")}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stacks
// ---------------------------------------------------------------------------

async function processStacks(args: {
  baseResume: string;
  stacksDir: string;
  outputDir: string;
  dryRun: boolean;
  onlySlug?: string;
}): Promise<TailoredResult[]> {
  const { baseResume, stacksDir, outputDir, dryRun, onlySlug } = args;

  let files: string[];
  try {
    files = (await fs.readdir(stacksDir)).filter((f) => f.endsWith(".yml"));
  } catch {
    console.log("ℹ️   No stacks directory found — skipping stack tailoring.");
    return [];
  }

  if (onlySlug) {
    files = files.filter((f) => f.replace(/\.yml$/, "") === onlySlug);
  }

  files.sort();

  if (files.length === 0) {
    console.log("ℹ️   No stack configs found — skipping stack tailoring.");
    return [];
  }

  const results: TailoredResult[] = [];

  for (const file of files) {
    const slug = file.replace(/\.yml$/, "");
    const stackPath = path.join(stacksDir, file);

    let rawProfile: unknown;
    try {
      rawProfile = yaml.load(await fs.readFile(stackPath, "utf-8"));
    } catch {
      console.warn(`⚠️   Skipping ${slug}: could not read ${stackPath}`);
      continue;
    }

    if (!rawProfile || typeof rawProfile !== "object") {
      console.warn(
        `⚠️   Skipping ${slug}: stack profile in ${stackPath} is not an object`
      );
      continue;
    }

    const maybeProfile = rawProfile as { [key: string]: unknown };
    if (typeof maybeProfile.name !== "string") {
      console.warn(
        `⚠️   Skipping ${slug}: stack profile in ${stackPath} is missing a valid 'name'`
      );
      continue;
    }

    const technologies = maybeProfile.technologies;
    if (
      !Array.isArray(technologies) ||
      !technologies.every((t) => typeof t === "string")
    ) {
      console.warn(
        `⚠️   Skipping ${slug}: stack profile in ${stackPath} has an invalid 'technologies' field`
      );
      continue;
    }

    const profile = rawProfile as StackProfile;
    console.log(`\n🔧  [stack] ${profile.name}`);

    if (dryRun) {
      console.log("     (dry-run, skipping AI call)");
      results.push(makeDryResult("stack", slug));
      continue;
    }

    const resume = await tailorResume({ baseResume, stackProfile: profile });
    const result = makeResult("stack", slug, resume);
    results.push(result);

    const outDir = path.join(outputDir, "stacks", slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "resume.md"), resume);
    console.log(`     ✏️   Written to ${path.join(outDir, "resume.md")}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readDirSlugs(dir: string, only?: string): Promise<string[]> {
  let entries: string[];
  try {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    entries = dirEntries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  return only ? entries.filter((e) => e === only) : entries;
}

function makeResult(
  type: "job" | "stack",
  slug: string,
  resume: string
): TailoredResult {
  return { type, slug, resume, generatedAt: new Date().toISOString() };
}

function makeDryResult(type: "job" | "stack", slug: string): TailoredResult {
  return {
    type,
    slug,
    resume: "(dry-run)",
    generatedAt: new Date().toISOString(),
  };
}
