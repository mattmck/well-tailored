import { complete as defaultComplete } from '../lib/ai.js';
import { diffMarkdown } from '../lib/diff.js';
import { tailorDocuments } from '../lib/tailor.js';
import { renderCoverLetterHtml, renderResumeHtml } from '../lib/render.js';
import { analyzeGapWithAI } from './gap.js';
import { scoreTailoredOutput } from './scoring.js';
import {
  AgentSelection,
  ExperienceOrder,
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
  experienceOrder?: ExperienceOrder;
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
  // Inject ordering instruction into the resume system prompt when chronological is requested.
  const resolvedPromptOverrides: PromptOverrides | undefined =
    args.experienceOrder === 'chronological'
      ? {
          ...args.promptOverrides,
          resumeSystem: (args.promptOverrides?.resumeSystem ?? '') +
            '\n\nEXPERIENCE ORDERING: Keep all employers in strict reverse-chronological order (most recent first) in both ## Experience and ## Additional Experience. Do NOT reorder employers by relevance.',
        }
      : args.promptOverrides;

  const output = await tailorDocuments(
    args.agents.tailoringModel,
    args.input,
    args.verbose ?? false,
    tailoringComplete,
    resolvedPromptOverrides,
  );

  const artifacts = {
    resumeHtml: renderResumeHtml(output.resume, `Resume - ${args.input.company}`, false, args.theme, args.experienceOrder),
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

  const gapAnalysis = await analyzeGapWithAI(
    args.input.resume,
    args.input.bio,
    args.input.jobDescription,
    args.input.jobTitle,
    args.agents.tailoringModel,
    tailoringComplete,
  );

  return {
    output,
    artifacts,
    scorecard,
    diff: diffMarkdown(args.input.resume, output.resume),
    gapAnalysis,
  };
}
