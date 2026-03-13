/**
 * End-to-end smoke test for the tailoring pipeline.
 *
 * Wires together: prompts → tailorDocuments → render (HTML).
 * AI calls are mocked so this never hits the network, but everything
 * else (prompt construction and markdown→HTML rendering) is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tailorDocuments } from '../src/lib/tailor.js';
import { renderResumeHtml, renderCoverLetterHtml } from '../src/lib/render.js';
import { TailorInput } from '../src/types/index.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const sampleInput: TailorInput = {
  resume: `# Jane Doe

## Senior Software Engineer

jane@example.com | github.com/janedoe | San Francisco, CA

## Experience

### Staff Engineer | Acme Corp | San Francisco, CA
2020 – Present
- Led migration of monolithic API to microservices, reducing p95 latency by 40%
- Mentored 5 junior engineers through code review and pair programming

### Software Engineer | StartupCo | Remote
2017 – 2020
- Built real-time data pipeline processing 2M events/day
- Designed and shipped OAuth 2.0 integration used by 50K+ users`,
  bio: `Experienced full-stack engineer with 8+ years in distributed systems, API design, and team leadership. Passionate about developer experience and building reliable infrastructure.`,
  company: 'TechCorp',
  jobTitle: 'Principal Engineer',
  jobDescription: `We're looking for a Principal Engineer to lead our platform team.

Requirements:
- 10+ years of software engineering experience
- Deep expertise in distributed systems and microservices
- Track record of technical leadership and mentoring
- Experience with cloud infrastructure (AWS/GCP)
- Strong communication skills

Nice to have:
- Experience with Kubernetes and service mesh
- Background in developer tooling and CI/CD`,
};

// Canned AI responses that look like real tailored output
const MOCK_RESUME = `# Jane Doe

## Principal Engineer

jane@example.com | github.com/janedoe | San Francisco, CA

## Experience

### Staff Engineer | Acme Corp | San Francisco, CA
2020 – Present
- Led architecture migration from monolithic API to microservices platform, reducing p95 latency by 40% and improving team deployment velocity
- Mentored 5 junior engineers through structured code review and pair programming sessions
- Drove technical strategy for platform reliability across 3 engineering teams

### Software Engineer | StartupCo | Remote
2017 – 2020
- Architected real-time data pipeline processing 2M events/day on AWS infrastructure
- Designed and shipped OAuth 2.0 integration serving 50K+ users with 99.9% uptime

## Skills
Distributed Systems · Microservices · AWS · API Design · Technical Leadership · Mentoring`;

const MOCK_COVER_LETTER = `Dear Hiring Team,

I'm excited to apply for the Principal Engineer role at TechCorp. With 8+ years leading distributed systems work — most recently driving Acme Corp's microservices migration that cut p95 latency by 40% — I bring the technical depth and leadership experience your platform team needs.

At Acme, I've grown from individual contributor to technical lead across 3 teams, combining hands-on architecture work with structured mentoring for 5 junior engineers. My earlier work at StartupCo building a 2M event/day pipeline on AWS gave me the infrastructure fundamentals that inform my current platform strategy.

I'd love to discuss how my experience maps to TechCorp's platform challenges. I'm available for a conversation at your convenience.

Best regards,
Jane Doe`;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('smoke: full pipeline', () => {
  let mockComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockComplete = vi.fn()
      .mockImplementationOnce(async () => MOCK_RESUME)
      .mockImplementationOnce(async () => MOCK_COVER_LETTER);
  });

  it('tailorDocuments produces resume and cover letter', async () => {
    const result = await tailorDocuments('auto', sampleInput, false, mockComplete);

    expect(result.resume).toBeTruthy();
    expect(result.coverLetter).toBeTruthy();
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });

  it('system prompts contain required guardrails', async () => {
    await tailorDocuments('auto', sampleInput, false, mockComplete);

    // Both calls should have system prompts with accuracy rules
    const resumeSystemPrompt = mockComplete.mock.calls[0][1];
    const coverLetterSystemPrompt = mockComplete.mock.calls[1][1];

    expect(resumeSystemPrompt).toContain('NEVER invent');
    expect(resumeSystemPrompt).toContain('markdown');
    expect(coverLetterSystemPrompt).toContain('NEVER invent');
    expect(coverLetterSystemPrompt).toContain('first person');
  });

  it('user prompts include all input fields', async () => {
    await tailorDocuments('auto', sampleInput, false, mockComplete);

    const resumeUserPrompt = mockComplete.mock.calls[0][2];
    const coverLetterUserPrompt = mockComplete.mock.calls[1][2];

    // Both prompts should contain all source material
    for (const prompt of [resumeUserPrompt, coverLetterUserPrompt]) {
      expect(prompt).toContain('TechCorp');
      expect(prompt).toContain('Principal Engineer');
      expect(prompt).toContain('distributed systems');
      expect(prompt).toContain('Jane Doe');
    }
  });

  it('renderResumeHtml produces valid HTML from tailored resume', async () => {
    const result = await tailorDocuments('auto', sampleInput, false, mockComplete);
    const html = renderResumeHtml(result.resume, 'Resume - TechCorp');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Resume - TechCorp</title>');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Principal Engineer');
    // Job sections should be wrapped
    expect(html).toContain('Acme Corp');
    // Should not contain raw markdown
    expect(html).not.toContain('###');
  });

  it('renderCoverLetterHtml produces valid HTML from tailored cover letter', async () => {
    const result = await tailorDocuments('auto', sampleInput, false, mockComplete);
    const html = renderCoverLetterHtml(result.coverLetter, 'Cover Letter - TechCorp');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Cover Letter');
    expect(html).toContain('TechCorp');
    expect(html).toContain('Jane Doe');
  });

  it('handles supplemental resume content', async () => {
    const inputWithSupplemental = {
      ...sampleInput,
      resumeSupplemental: '## Additional Projects\n- Open source Kubernetes operator with 500+ GitHub stars',
    };

    const mockFn = vi.fn()
      .mockImplementationOnce(async () => MOCK_RESUME)
      .mockImplementationOnce(async () => MOCK_COVER_LETTER);

    await tailorDocuments('auto', inputWithSupplemental, false, mockFn);

    const resumeUserPrompt = mockFn.mock.calls[0][2];
    expect(resumeUserPrompt).toContain('Kubernetes operator');
    expect(resumeUserPrompt).toContain('Supplemental');
  });

  it('handles base cover letter reference', async () => {
    const inputWithBaseCL = {
      ...sampleInput,
      baseCoverLetter: 'Dear Hiring Manager, I have always been passionate about...',
    };

    const mockFn = vi.fn()
      .mockImplementationOnce(async () => MOCK_RESUME)
      .mockImplementationOnce(async () => MOCK_COVER_LETTER);

    await tailorDocuments('auto', inputWithBaseCL, false, mockFn);

    const coverLetterUserPrompt = mockFn.mock.calls[1][2];
    expect(coverLetterUserPrompt).toContain('Base Cover Letter');
    expect(coverLetterUserPrompt).toContain('passionate about');
  });
});
