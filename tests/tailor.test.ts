import { describe, it, expect, vi } from 'vitest';
import { tailorDocuments, tailorResume } from '../src/lib/tailor.js';
import { TailorInput } from '../src/types/index.js';

const sampleInput: TailorInput = {
  resume: '# Jane Doe',
  bio: 'I build things.',
  company: 'Acme Corp',
  jobTitle: 'Engineer',
  jobDescription: 'Build great software.',
};

describe('tailorDocuments', () => {
  it('calls complete twice in parallel and returns both outputs', async () => {
    const mockComplete = vi.fn()
      .mockImplementationOnce(async () => '# Tailored Resume')
      .mockImplementationOnce(async () => 'Dear Hiring Manager,');

    const result = await tailorDocuments('haiku', sampleInput, false, mockComplete);

    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(result.resume).toBe('# Tailored Resume');
    expect(result.coverLetter).toBe('Dear Hiring Manager,');
  });

  it('propagates errors from either parallel call', async () => {
    const mockComplete = vi.fn()
      .mockImplementationOnce(async () => { throw new Error('API timeout'); });

    await expect(tailorDocuments('haiku', sampleInput, false, mockComplete)).rejects.toThrow('API timeout');
  });
});

describe('tailorResume', () => {
  it('calls complete exactly once and returns the resume string', async () => {
    const mockComplete = vi.fn().mockResolvedValueOnce('# Stack-Tailored Resume');

    const result = await tailorResume('haiku', sampleInput, false, mockComplete);

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(result).toBe('# Stack-Tailored Resume');
  });

  it('propagates errors from the AI call', async () => {
    const mockComplete = vi.fn().mockRejectedValueOnce(new Error('API timeout'));

    await expect(tailorResume('haiku', sampleInput, false, mockComplete)).rejects.toThrow('API timeout');
  });
});
