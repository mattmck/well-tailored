import { describe, it, expect, vi } from 'vitest';
import { tailorDocuments, tailorResume } from '../src/lib/tailor.js';
import * as files from '../src/lib/files.js';
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

    const loadPromptSpy = vi.spyOn(files, 'loadPrompt').mockImplementation((filename, defaultValue) => {
      if (filename === 'resume-system.md') return 'resume system prompt';
      if (filename === 'cover-letter-system.md') return 'cover letter system prompt';
      return defaultValue;
    });

    try {
      const result = await tailorDocuments('auto', sampleInput, false, mockComplete);

      expect(mockComplete).toHaveBeenCalledTimes(2);
      expect(mockComplete).toHaveBeenNthCalledWith(
        1,
        'auto',
        'resume system prompt',
        expect.stringContaining('Now produce the tailored resume.'),
        false,
      );
      expect(mockComplete).toHaveBeenNthCalledWith(
        2,
        'auto',
        'cover letter system prompt',
        expect.stringContaining('Now produce the cover letter.'),
        false,
      );
      expect(result.resume).toBe('# Tailored Resume');
      expect(result.coverLetter).toBe('Dear Hiring Manager,');
    } finally {
      loadPromptSpy.mockRestore();
    }
  });

  it('propagates errors from either parallel call', async () => {
    const mockComplete = vi.fn()
      .mockImplementationOnce(async () => { throw new Error('API timeout'); });

    await expect(tailorDocuments('haiku', sampleInput, false, mockComplete)).rejects.toThrow('API timeout');
  });

  it('uses prompt overrides when provided', async () => {
    const mockComplete = vi.fn()
      .mockResolvedValueOnce('# Tailored Resume')
      .mockResolvedValueOnce('Tailored cover letter');

    await tailorDocuments(
      'haiku',
      sampleInput,
      false,
      mockComplete,
      {
        resumeSystem: 'resume override',
        coverLetterSystem: 'cover override',
      },
    );

    expect(mockComplete).toHaveBeenNthCalledWith(
      1,
      'haiku',
      'resume override',
      expect.any(String),
      false,
    );
    expect(mockComplete).toHaveBeenNthCalledWith(
      2,
      'haiku',
      'cover override',
      expect.any(String),
      false,
    );
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
