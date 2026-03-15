import { complete as defaultComplete } from '../lib/ai.js';
import { tailorDocuments } from '../lib/tailor.js';
import { renderCoverLetterHtml, renderResumeHtml } from '../lib/render.js';
import { scoreTailoredOutput } from './scoring.js';
import {
  AgentSelection,
  PromptOverrides,
  ResumeTheme,
  TailorInput,
  TailorRunResult,
} from '../types/index.js';

export interface RunTailorWorkflowArgs {
  input: TailorInput;
  agents: AgentSelection;
  promptOverrides?: PromptOverrides;
  theme?: Partial<ResumeTheme>;
  includeScoring?: boolean;
  verbose?: boolean;
  complete?: typeof defaultComplete;
}

export async function runTailorWorkflow(args: RunTailorWorkflowArgs): Promise<TailorRunResult> {
  const complete = args.complete ?? defaultComplete;
  const tailoringComplete = (
    model: string,
    systemPrompt: string,
    userPrompt: string,
    verbose?: boolean,
  ) => complete(model, systemPrompt, userPrompt, verbose, {
    provider: args.agents.tailoringProvider,
  });
  const scoringComplete = (
    model: string,
    systemPrompt: string,
    userPrompt: string,
    verbose?: boolean,
  ) => complete(model, systemPrompt, userPrompt, verbose, {
    provider: args.agents.scoringProvider ?? args.agents.tailoringProvider,
  });
  const output = await tailorDocuments(
    args.agents.tailoringModel,
    args.input,
    args.verbose ?? false,
    tailoringComplete,
    args.promptOverrides,
  );

  const artifacts = {
    resumeHtml: renderResumeHtml(output.resume, `Resume - ${args.input.company}`, false, args.theme),
    coverLetterHtml: renderCoverLetterHtml(output.coverLetter, `Cover Letter - ${args.input.company}`, args.theme),
  };

  const scorecard = args.includeScoring
    ? await scoreTailoredOutput({
      input: args.input,
      output,
      scoringModel: args.agents.scoringModel ?? args.agents.tailoringModel,
      promptOverrides: args.promptOverrides,
      verbose: args.verbose,
      complete: scoringComplete,
    })
    : undefined;

  return { output, artifacts, scorecard };
}
