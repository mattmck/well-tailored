import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tailorDocuments, tailorResume } from '../src/lib/tailor.js';
import { TailorInput } from '../src/types/index.js';
import * as aiModule from '../src/lib/ai.js';
import type OpenAI from 'openai';

const sampleInput: TailorInput = {
  resume: '# Jane Doe',
  bio: 'I build things.',
  company: 'Acme Corp',
  jobTitle: 'Engineer',
  jobDescription: 'Build great software.',
};

describe('tailorDocuments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls complete twice in parallel and returns both outputs', async () => {
    const completeSpy = vi
      .spyOn(aiModule, 'complete')
      .mockImplementationOnce(async () => '# Tailored Resume')
      .mockImplementationOnce(async () => 'Dear Hiring Manager,');

    const result = await tailorDocuments({} as OpenAI, 'gpt-4o', sampleInput);

    expect(completeSpy).toHaveBeenCalledTimes(2);
    expect(result.resume).toBe('# Tailored Resume');
    expect(result.coverLetter).toBe('Dear Hiring Manager,');
  });

  it('propagates errors from either parallel call', async () => {
    vi.spyOn(aiModule, 'complete')
      .mockImplementationOnce(async () => { throw new Error('API timeout'); })
      .mockImplementationOnce(async () => 'Cover letter');

    await expect(tailorDocuments({} as OpenAI, 'gpt-4o', sampleInput)).rejects.toThrow('API timeout');
  });
});

describe('tailorResume', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls complete exactly once and returns the resume string', async () => {
    const completeSpy = vi
      .spyOn(aiModule, 'complete')
      .mockResolvedValueOnce('# Stack-Tailored Resume');

    const result = await tailorResume({} as OpenAI, 'gpt-4o', sampleInput);

    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe('# Stack-Tailored Resume');
  });

  it('propagates errors from the AI call', async () => {
    vi.spyOn(aiModule, 'complete').mockRejectedValueOnce(new Error('API timeout'));

    await expect(tailorResume({} as OpenAI, 'gpt-4o', sampleInput)).rejects.toThrow('API timeout');
  });
});
