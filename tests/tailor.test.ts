import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tailorDocuments } from '../src/lib/tailor.js';
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
