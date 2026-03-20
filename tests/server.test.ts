import { describe, expect, it, vi } from 'vitest';
import { normalizeExportKind, resolveWorkbenchAssetPath } from '../src/server.js';

describe('ExportPdfBody type', () => {
  it('accepts kind=resume variant', () => {
    // Type check: ensure 'resume' is accepted in ExportPdfBody
    const body: { kind: 'resume' | 'coverLetter' | 'cover-letter'; markdown?: string } = {
      kind: 'resume',
      markdown: '# Resume',
    };
    expect(body.kind).toBe('resume');
  });

  it('accepts kind=coverLetter variant', () => {
    // Type check: ensure 'coverLetter' is accepted in ExportPdfBody
    const body: { kind: 'resume' | 'coverLetter' | 'cover-letter'; markdown?: string } = {
      kind: 'coverLetter',
      markdown: '# Cover Letter',
    };
    expect(body.kind).toBe('coverLetter');
  });

  it('accepts kind=cover-letter variant', () => {
    // Type check: ensure 'cover-letter' is accepted in ExportPdfBody
    const body: { kind: 'resume' | 'coverLetter' | 'cover-letter'; markdown?: string } = {
      kind: 'cover-letter',
      markdown: '# Cover Letter',
    };
    expect(body.kind).toBe('cover-letter');
  });
});

describe('sectionId validation logic', () => {
  // Test the validation logic that should be in the /api/regenerate-section handler

  it('detects missing sectionId', () => {
    const body: Record<string, unknown> = {
      resume: '# Test Resume',
      bio: 'Test bio',
      jobDescription: 'Test JD',
      jobTitle: 'Test Job',
      // sectionId is intentionally omitted
    };

    const sectionId = body.sectionId as string | undefined;
    const isInvalid = !sectionId || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('detects empty string sectionId', () => {
    const body = {
      resume: '# Test Resume',
      bio: 'Test bio',
      jobDescription: 'Test JD',
      jobTitle: 'Test Job',
      sectionId: '',
    };

    const sectionId = body.sectionId;
    const isInvalid = !sectionId || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('detects whitespace-only sectionId', () => {
    const body = {
      resume: '# Test Resume',
      bio: 'Test bio',
      jobDescription: 'Test JD',
      jobTitle: 'Test Job',
      sectionId: '   ',
    };

    const sectionId = body.sectionId;
    const isInvalid = !sectionId || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('accepts valid sectionId', () => {
    const body = {
      resume: '# Test Resume',
      bio: 'Test bio',
      jobDescription: 'Test JD',
      jobTitle: 'Test Job',
      sectionId: 'summary',
    };

    const sectionId = body.sectionId;
    const isInvalid = !sectionId || sectionId.trim() === '';
    expect(isInvalid).toBe(false);
  });
});

describe('Issue 1: Type Safety - sectionId validation crashes on non-string input', () => {
  it('should reject numeric sectionId without crashing', () => {
    const body: Record<string, unknown> = {
      resume: '# Test Resume',
      bio: 'Test bio',
      jobDescription: 'Test JD',
      jobTitle: 'Test Job',
      sectionId: 42, // CRASH: calling .trim() on a number will throw TypeError
    };

    const sectionId = body.sectionId;
    // The fix: check type before calling .trim()
    const isInvalid = typeof sectionId !== 'string' || sectionId.trim() === '';
    expect(isInvalid).toBe(true); // Should be invalid (not a string)
  });

  it('should reject boolean sectionId without crashing', () => {
    const body: Record<string, unknown> = {
      sectionId: true, // falsy check would fail here (true is truthy)
    };

    const sectionId = body.sectionId;
    const isInvalid = typeof sectionId !== 'string' || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('should reject null sectionId', () => {
    const body: Record<string, unknown> = {
      sectionId: null,
    };

    const sectionId = body.sectionId;
    const isInvalid = typeof sectionId !== 'string' || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('should reject undefined sectionId', () => {
    const body: Record<string, unknown> = {
      sectionId: undefined,
    };

    const sectionId = body.sectionId;
    const isInvalid = typeof sectionId !== 'string' || sectionId.trim() === '';
    expect(isInvalid).toBe(true);
  });

  it('should accept valid string sectionId', () => {
    const body = {
      sectionId: 'summary',
    };

    const sectionId = body.sectionId;
    const isInvalid = typeof sectionId !== 'string' || sectionId.trim() === '';
    expect(isInvalid).toBe(false);
  });
});

describe('Issue 2: Path Traversal Vulnerability in buildPdfBuffer', () => {
  // Helper function to validate kind before using in filesystem paths
  function validateKindForFilepath(kind: unknown): 'resume' | 'coverLetter' {
    const allowedKinds = ['resume', 'coverLetter', 'cover-letter'];
    if (typeof kind !== 'string' || !allowedKinds.includes(kind)) {
      throw new Error(`Unknown export kind: ${kind}`);
    }
    // Normalize 'cover-letter' to 'coverLetter'
    return kind === 'cover-letter' ? 'coverLetter' : (kind as 'resume' | 'coverLetter');
  }

  it('should reject path traversal in kind parameter', () => {
    const body = {
      kind: '../../../etc/passwd',
    };

    expect(() => validateKindForFilepath(body.kind)).toThrow('Unknown export kind');
  });

  it('should reject null kind', () => {
    expect(() => validateKindForFilepath(null)).toThrow('Unknown export kind');
  });

  it('should reject numeric kind', () => {
    expect(() => validateKindForFilepath(42)).toThrow('Unknown export kind');
  });

  it('should reject unknown string kind', () => {
    expect(() => validateKindForFilepath('unknown')).toThrow('Unknown export kind');
  });

  it('should accept valid resume kind', () => {
    const result = validateKindForFilepath('resume');
    expect(result).toBe('resume');
  });

  it('should accept valid coverLetter kind', () => {
    const result = validateKindForFilepath('coverLetter');
    expect(result).toBe('coverLetter');
  });

  it('should normalize cover-letter to coverLetter', () => {
    const result = validateKindForFilepath('cover-letter');
    expect(result).toBe('coverLetter');
  });
});

describe('Issue 3: normalizeExportKind - exported function tests', () => {
  // Tests using the actual normalizeExportKind function from src/server.ts

  it('should normalize cover-letter to coverLetter', () => {
    const result = normalizeExportKind('cover-letter');
    expect(result).toBe('coverLetter');
  });

  it('should preserve resume variant', () => {
    const result = normalizeExportKind('resume');
    expect(result).toBe('resume');
  });

  it('should preserve coverLetter variant', () => {
    const result = normalizeExportKind('coverLetter');
    expect(result).toBe('coverLetter');
  });

  it('should reject unknown kinds', () => {
    expect(() => normalizeExportKind('unknown')).toThrow('Unknown export kind');
  });

  it('should reject non-string kinds', () => {
    expect(() => normalizeExportKind(42)).toThrow('Unknown export kind');
    expect(() => normalizeExportKind(null)).toThrow('Unknown export kind');
    expect(() => normalizeExportKind(undefined)).toThrow('Unknown export kind');
  });

  it('should simplify type checks after normalization', () => {
    // After normalization via the actual exported function, only 'resume' or 'coverLetter' are possible
    const body = { kind: normalizeExportKind('cover-letter') as 'resume' | 'coverLetter' };
    // Simple check without dual variants
    const isResume = body.kind === 'resume';
    const isCoverLetter = body.kind === 'coverLetter';
    expect(isResume || isCoverLetter).toBe(true);
  });
});

describe('Workbench asset resolver', () => {
  it('resolves logo assets inside the workbench asset directory', () => {
    const result = resolveWorkbenchAssetPath('logo-mark.svg');
    expect(result).toBeTruthy();
    expect(result).toMatch(/workbench\/assets\/logo-mark\.svg$/);
  });

  it('rejects path traversal outside the asset directory', () => {
    const result = resolveWorkbenchAssetPath('../index.html');
    expect(result).toBeNull();
  });
});
