import { describe, expect, it, vi } from 'vitest';
import { regenerateResumeSection } from '../src/services/review.js';

describe('regenerateResumeSection', () => {
  it('rewrites only the requested section and reassembles the resume', async () => {
    const resume = `# Jane Doe

## Summary
Platform engineer with strong backend experience.

## Experience
- Built internal tools
- Improved reliability`;

    const result = await regenerateResumeSection({
      resume,
      bio: 'Platform-focused engineer who likes developer tooling.',
      jobDescription: 'Need stronger TypeScript and AWS emphasis.',
      jobTitle: 'Senior Platform Engineer',
      sectionId: 'experience',
      model: 'gpt-4o-mini',
      complete: vi.fn().mockResolvedValue(`## Experience
- Built TypeScript tooling on AWS
- Improved reliability for internal platforms`),
    });

    expect(result.section.content).toContain('TypeScript tooling on AWS');
    expect(result.section.content).not.toContain('## Experience');
    expect(result.markdown).toContain('## Summary\nPlatform engineer with strong backend experience.');
    expect(result.markdown).toContain('## Experience\n- Built TypeScript tooling on AWS');
  });
});
