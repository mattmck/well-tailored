#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { release } from "./release.js";

const program = new Command();

program
  .name("job-shit")
  .description("Automated resume tailoring pipeline")
  .version("1.0.0");

program
  .command("release")
  .description(
    "Generate tailored resumes for all configured jobs and stack profiles"
  )
  .option("--dry-run", "Show what would be generated without calling the AI")
  .option("--job <slug>", "Only process this one job slug")
  .option("--stack <slug>", "Only process this one stack slug")
  .option("--resume <path>", "Path to the base resume (default: resume/base.md)")
  .option("--jobs-dir <path>", "Directory containing job configs (default: jobs/)")
  .option(
    "--stacks-dir <path>",
    "Directory containing stack configs (default: stacks/)"
  )
  .option(
    "--output-dir <path>",
    "Directory to write tailored resumes (default: output/)"
  )
  .action(async (opts) => {
    try {
      await release({
        dryRun: opts.dryRun ?? false,
        resumePath: opts.resume,
        jobsDir: opts.jobsDir,
        stacksDir: opts.stacksDir,
        outputDir: opts.outputDir,
        job: opts.job,
        stack: opts.stack,
      });
    } catch (err) {
      console.error("❌  Release failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error("❌  Command execution failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
