import { describe, it, expect } from 'vitest';
import {
  resumeSystemPrompt,
  resumeUserPrompt,
  coverLetterSystemPrompt,
  coverLetterUserPrompt,
} from '../src/lib/prompts.js';
import { TailorInput } from '../src/types/index.js';

const sampleInput: TailorInput = {
  resume: '# Jane Doe\n## Experience\n- Built things',
  bio: 'I love building software.',
  company: 'Acme Corp',
  jobTitle: 'Senior Software Engineer',
  jobDescription: 'We need someone who builds things well.',
};

describe('prompts', () => {
  describe('resumeSystemPrompt', () => {
    it('instructs not to invent credentials', () => {
      expect(resumeSystemPrompt()).toContain('NEVER invent, fabricate');
    });

    it('asks for markdown output only', () => {
      expect(resumeSystemPrompt()).toContain('ONLY the tailored resume in markdown');
    });
  });

  describe('resumeUserPrompt', () => {
    it('includes company name', () => {
      expect(resumeUserPrompt(sampleInput)).toContain('Acme Corp');
    });

    it('includes job title', () => {
      expect(resumeUserPrompt(sampleInput)).toContain('Senior Software Engineer');
    });

    it('includes job description', () => {
      expect(resumeUserPrompt(sampleInput)).toContain('builds things well');
    });

    it('includes base resume', () => {
      expect(resumeUserPrompt(sampleInput)).toContain('Built things');
    });

    it('includes bio', () => {
      expect(resumeUserPrompt(sampleInput)).toContain('I love building software');
    });

    it('falls back gracefully when jobTitle is missing', () => {
      const input = { ...sampleInput, jobTitle: undefined };
      expect(resumeUserPrompt(input)).toContain('(see job description)');
    });

    it('includes supplemental section when resumeSupplemental is provided', () => {
      const input = { ...sampleInput, resumeSupplemental: 'Led a 10-person team at Startup X.' };
      const prompt = resumeUserPrompt(input);
      expect(prompt).toContain('Supplemental Resume Detail');
      expect(prompt).toContain('Led a 10-person team at Startup X.');
    });

    it('omits supplemental section when resumeSupplemental is absent', () => {
      const prompt = resumeUserPrompt(sampleInput);
      expect(prompt).not.toContain('Supplemental Resume Detail');
    });
  });

  describe('coverLetterSystemPrompt', () => {
    it('instructs first-person voice', () => {
      expect(coverLetterSystemPrompt()).toContain('first person');
    });

    it('asks for cover letter text only', () => {
      expect(coverLetterSystemPrompt()).toContain('ONLY the finished cover letter text');
    });
  });

  describe('coverLetterUserPrompt', () => {
    it('includes company name', () => {
      expect(coverLetterUserPrompt(sampleInput)).toContain('Acme Corp');
    });

    it('includes job title', () => {
      expect(coverLetterUserPrompt(sampleInput)).toContain('Senior Software Engineer');
    });

    it('includes base cover letter section when baseCoverLetter is provided', () => {
      const input = { ...sampleInput, baseCoverLetter: 'Dear Hiring Manager, I bring deep experience...' };
      const prompt = coverLetterUserPrompt(input);
      expect(prompt).toContain('My Base Cover Letter');
      expect(prompt).toContain('Dear Hiring Manager, I bring deep experience...');
    });

    it('omits base cover letter section when baseCoverLetter is absent', () => {
      const prompt = coverLetterUserPrompt(sampleInput);
      expect(prompt).not.toContain('My Base Cover Letter');
    });
  });
});
