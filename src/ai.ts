import OpenAI from "openai";
import type { TailoringContext } from "./types.js";

const SYSTEM_PROMPT = `\
You are an expert resume writer and career coach.
Your task is to tailor the provided base resume for a specific target.
Rules:
- Preserve all factual content: companies, roles, dates, education, and projects.
- Reorder and rewrite bullet points to emphasise the most relevant skills and experience for the target.
- Do NOT invent experience or qualifications that are not present in the base resume.
- Return ONLY the tailored resume in Markdown, with no preamble, explanation, or commentary.`;

export async function tailorResume(
  context: TailoringContext,
  model = process.env.OPENAI_MODEL ?? "gpt-4o"
): Promise<string> {
  const client = new OpenAI();

  const userPrompt = buildUserPrompt(context);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }
  return content.trim();
}

function buildUserPrompt(context: TailoringContext): string {
  const { baseResume, jobConfig, stackProfile } = context;

  if (jobConfig) {
    return `\
Tailor the resume below for the following job application.

## Company
${jobConfig.company}

## Job Title
${jobConfig.title}

## Job Description
${jobConfig.description}
${jobConfig.notes ? `\n## Personal Notes\n${jobConfig.notes}\n` : ""}
## Base Resume
${baseResume}

Emphasise the experience and skills most relevant to this role at ${jobConfig.company}. \
Reorder bullet points so the strongest matches appear first in each section.`;
  }

  if (stackProfile) {
    return `\
Tailor the resume below to emphasise experience with the following technology stack.

## Stack: ${stackProfile.name}
## Technologies
${stackProfile.technologies.join(", ")}
${stackProfile.emphasis ? `\n## Emphasis\n${stackProfile.emphasis}\n` : ""}
## Base Resume
${baseResume}

Rewrite and reorder bullet points throughout the resume so that ${stackProfile.technologies.join(", ")} \
experience is foregrounded wherever it truthfully exists.`;
  }

  throw new Error(
    "TailoringContext must include either a jobConfig or a stackProfile"
  );
}
