import React, { useEffect, useState } from 'react';
import { Box, render, Text, useApp, useInput, useStdin } from 'ink';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { diffMarkdown } from '../lib/diff.js';
import { assembleSections, parseResumeSections } from '../lib/resume-parser.js';
import { analyzeGap } from '../services/gap.js';
import { regenerateResumeSection } from '../services/review.js';
import { GapAnalysis, ResumeSection } from '../types/index.js';

export interface ReviewSessionArgs {
  baseResume: string;
  resume: string;
  bio: string;
  company?: string;
  jobTitle?: string;
  jobDescription: string;
  model: string;
}

function normalizeSectionBody(section: ResumeSection, raw: string): string {
  let body = raw.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  if (section.headingLevel === 0 || !section.heading) {
    return body;
  }

  const headingLine = `${'#'.repeat(section.headingLevel)} ${section.heading}`;
  if (body.startsWith(headingLine)) {
    body = body.slice(headingLine.length).replace(/^\n+/, '');
  }

  return body;
}

function rebuildSection(section: ResumeSection, content: string): ResumeSection {
  const body = normalizeSectionBody(section, content);
  const synthetic = section.headingLevel > 0 && section.heading
    ? `${'#'.repeat(section.headingLevel)} ${section.heading}\n${body}`
    : body;
  const parsed = parseResumeSections(synthetic);
  const rebuilt = parsed.find((candidate) =>
    candidate.heading === section.heading && candidate.headingLevel === section.headingLevel)
    ?? parsed[0]
    ?? section;

  return {
    ...section,
    content: rebuilt.content,
    bullets: rebuilt.bullets,
  };
}

function sectionCoverage(section: ResumeSection, gapAnalysis: GapAnalysis) {
  const haystack = `${section.heading}\n${section.content}`.toLowerCase();

  const matched = gapAnalysis.matchedKeywords
    .map((keyword) => keyword.term)
    .filter((term) => haystack.includes(term.toLowerCase()))
    .slice(0, 4);
  const partial = gapAnalysis.partialMatches
    .filter((match) =>
      haystack.includes(match.jdTerm.toLowerCase()) || haystack.includes(match.resumeTerm.toLowerCase()))
    .slice(0, 3);

  return { matched, partial };
}

function visibleWindow<T>(items: T[], selectedIndex: number, radius = 5): T[] {
  const start = Math.max(0, selectedIndex - radius);
  const end = Math.min(items.length, selectedIndex + radius + 1);
  return items.slice(start, end);
}

function openInEditor(initial: string, setRawMode: (isEnabled: boolean) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'well-tailored-review-'));
  const path = join(dir, 'section.md');
  const editor = process.env.EDITOR || 'vi';

  try {
    writeFileSync(path, initial, 'utf8');
    setRawMode(false);
    // Run editor with shell=true to handle editor strings with flags (e.g., "vim -u ~/.vimrc")
    const result = spawnSync(editor, [path], { stdio: 'inherit', shell: true });
    if (result.error) {
      throw result.error;
    }
    // Check exit status and throw error if editor failed
    if (result.status !== 0 && result.status !== null) {
      throw new Error(`Editor exited with status ${result.status}`);
    }
    return readFileSync(path, 'utf8');
  } finally {
    setRawMode(true);
    rmSync(dir, { recursive: true, force: true });
  }
}

function SectionList(props: {
  sections: ResumeSection[];
  selectedIndex: number;
  acceptedIds: Set<string>;
}) {
  const windowed = visibleWindow(props.sections, props.selectedIndex);

  return (
    <Box flexDirection="column" width={34} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan">Sections</Text>
      {windowed.map((section, index) => {
        const absoluteIndex = props.sections.indexOf(section);
        const selected = absoluteIndex === props.selectedIndex;
        const accepted = props.acceptedIds.has(section.id);

        return (
          <Text key={section.id} color={selected ? 'green' : accepted ? 'yellow' : undefined}>
            {selected ? '>' : ' '} {accepted ? '✓' : ' '} {section.heading || '(Header)'}
          </Text>
        );
      })}
    </Box>
  );
}

function SectionDetail(props: {
  section: ResumeSection;
  baseSection?: ResumeSection;
  gapAnalysis: GapAnalysis;
  showDiff: boolean;
  expanded: boolean;
  status: string;
  accepted: boolean;
}) {
  const coverage = sectionCoverage(props.section, props.gapAnalysis);
  const diff = diffMarkdown(
    props.baseSection?.content ?? '',
    props.section.content,
  );

  const contentLines = props.showDiff
    ? diff.hunks.flatMap((hunk) =>
      hunk.lines.map((line) => `${hunk.type === 'added' ? '+' : hunk.type === 'removed' ? '-' : ' '} ${line}`))
    : props.section.content.split('\n');

  const visibleLines = props.expanded ? contentLines : contentLines.slice(0, 14);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan">
        {props.section.heading || 'Header'} [{props.section.type}]
        {props.accepted ? '  accepted' : ''}
      </Text>
      <Text color="gray">
        Coverage: {coverage.matched.length ? coverage.matched.join(', ') : 'none'}
        {coverage.partial.length ? ` | partial: ${coverage.partial.map((match) => match.jdTerm).join(', ')}` : ''}
      </Text>
      <Text color="gray">
        View: {props.showDiff ? 'diff vs base' : 'section content'} | {props.expanded ? 'expanded' : 'compact'}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleLines.map((line, index) => {
          const color = props.showDiff
            ? line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : 'gray'
            : undefined;
          return (
            <Text key={`${props.section.id}-${index}`} color={color}>
              {line.length ? line : ' '}
            </Text>
          );
        })}
        {!props.expanded && contentLines.length > visibleLines.length ? (
          <Text color="gray">… {contentLines.length - visibleLines.length} more lines</Text>
        ) : null}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">
          ↑/↓ navigate  enter expand  d diff  a accept  r regenerate  e edit in $EDITOR  q finish
        </Text>
        {props.status ? <Text color="yellow">{props.status}</Text> : null}
      </Box>
    </Box>
  );
}

function ReviewApp(props: {
  args: ReviewSessionArgs;
  onDone: (markdown: string) => void;
}) {
  const { exit } = useApp();
  const { setRawMode } = useStdin();
  const [sections, setSections] = useState(() => parseResumeSections(props.args.resume));
  const [baseSections] = useState(() => parseResumeSections(props.args.baseResume));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [status, setStatus] = useState('');
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [shouldExit, setShouldExit] = useState(false);

  // Compute gap analysis from live sections state, not from props.args.baseResume
  // This ensures badges reflect live edits and regenerations
  const gapAnalysis = analyzeGap(
    assembleSections(sections),
    props.args.jobDescription,
    props.args.jobTitle,
  );
  const selectedSection = sections[selectedIndex] ?? sections[0];
  const baseSection = baseSections.find((section) => section.id === selectedSection?.id);

  useEffect(() => {
    if (!shouldExit) {
      return;
    }

    props.onDone(assembleSections(sections));
    exit();
  }, [exit, props, sections, shouldExit]);

  useInput((input, key) => {
    if (!selectedSection || busy) {
      if (input === 'q') {
        setShouldExit(true);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((current) => Math.min(sections.length - 1, current + 1));
      return;
    }

    if (key.return) {
      setExpanded((current) => !current);
      return;
    }

    if (input === 'd') {
      setShowDiff((current) => !current);
      return;
    }

    if (input === 'a') {
      setAcceptedIds((current) => {
        const next = new Set(current);
        if (next.has(selectedSection.id)) {
          next.delete(selectedSection.id);
        } else {
          next.add(selectedSection.id);
        }
        return next;
      });
      setStatus(`Toggled acceptance for ${selectedSection.heading || 'header'}.`);
      return;
    }

    if (input === 'e') {
      try {
        const edited = openInEditor(selectedSection.content, setRawMode);
        setSections((current) => current.map((section) =>
          section.id === selectedSection.id ? rebuildSection(section, edited) : section));
        setStatus(`Updated ${selectedSection.heading || 'header'} from editor.`);
      } catch (error) {
        setStatus(`Editor failed: ${(error as Error).message}`);
      }
      return;
    }

    if (input === 'r') {
      setBusy(true);
      setStatus(`Regenerating ${selectedSection.heading || 'header'}...`);
      void regenerateResumeSection({
        resume: assembleSections(sections),
        bio: props.args.bio,
        jobDescription: props.args.jobDescription,
        jobTitle: props.args.jobTitle,
        sectionId: selectedSection.id,
        model: props.args.model,
      }).then((result) => {
        setSections(result.sections);
        setStatus(`Regenerated ${selectedSection.heading || 'header'}.`);
      }).catch((error) => {
        setStatus(`Regeneration failed: ${(error as Error).message}`);
      }).finally(() => {
        setBusy(false);
      });
      return;
    }

    if (input === 'q') {
      setShouldExit(true);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="cyan">
        Review Mode {props.args.company ? `· ${props.args.company}` : ''}{props.args.jobTitle ? ` · ${props.args.jobTitle}` : ''}
      </Text>
      <Text color="gray">
        {acceptedIds.size}/{sections.length} sections accepted
      </Text>
      <Box marginTop={1}>
        <SectionList sections={sections} selectedIndex={selectedIndex} acceptedIds={acceptedIds} />
        <Box marginLeft={1} flexGrow={1}>
          {selectedSection ? (
            <SectionDetail
              section={selectedSection}
              baseSection={baseSection}
              gapAnalysis={gapAnalysis}
              showDiff={showDiff}
              expanded={expanded}
              status={busy ? `${status} (working)` : status}
              accepted={acceptedIds.has(selectedSection.id)}
            />
          ) : (
            <Text>No sections found.</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}

const REVIEW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function launchReviewTui(args: ReviewSessionArgs): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let instance: ReturnType<typeof render>;
    try {
      instance = render(
        <ReviewApp
          args={args}
          onDone={(markdown) => {
            resolve(markdown);
            instance.unmount();
          }}
        />,
      );
    } catch (err) {
      reject(new Error(`Failed to launch review TUI: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }

    setTimeout(() => {
      instance.unmount();
      reject(new Error('Review TUI timed out after 30 minutes of inactivity.'));
    }, REVIEW_TIMEOUT_MS);
  });
}
