import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { PromptSources } from '../../types';

interface PromptField {
  key: keyof PromptSources;
  label: string;
}

const PROMPT_FIELDS: PromptField[] = [
  { key: 'resumeSystem', label: 'RESUME SYSTEM PROMPT' },
  { key: 'coverLetterSystem', label: 'COVER LETTER SYSTEM PROMPT' },
  { key: 'scoringSystem', label: 'SCORING SYSTEM PROMPT' },
];

export function PromptsPanel() {
  const { state, dispatch } = useWorkspace();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleTextChange(key: keyof PromptSources, value: string) {
    dispatch({
      type: 'SET_PROMPT_SOURCES',
      sources: { ...state.promptSources, [key]: value },
    });
  }

  function handleFileUpload(key: keyof PromptSources, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      dispatch({
        type: 'SET_PROMPT_SOURCES',
        sources: { ...state.promptSources, [key]: text },
      });
    };
    reader.readAsText(file);
  }

  function getSourceLabel(key: keyof PromptSources): string {
    const value = state.promptSources[key];
    if (!value) return 'Using built-in default';
    return 'Loaded from local defaults';
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {PROMPT_FIELDS.map((field) => (
        <div key={field.key} style={{ marginBottom: '16px' }}>
          {/* Label row with upload button */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {field.label}
            </span>
            <button
              onClick={() => fileRefs.current[field.key]?.click()}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-secondary/50"
              aria-label={`Upload ${field.label}`}
              title={`Upload ${field.label.toLowerCase()} file`}
            >
              <Upload size={11} strokeWidth={2} />
              <span>Upload</span>
            </button>
          </div>

          {/* Source label */}
          <div className="text-xs text-muted-foreground mb-1.5">
            {getSourceLabel(field.key)}
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            accept=".txt,.md"
            className="hidden"
            ref={(el) => { fileRefs.current[field.key] = el; }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(field.key, file);
              e.target.value = '';
            }}
          />

          {/* Textarea */}
          <textarea
            value={state.promptSources[field.key] ?? ''}
            onChange={(e) => handleTextChange(field.key, e.target.value)}
            placeholder={`Override ${field.label.toLowerCase()}…`}
            className="w-full border border-border rounded bg-background text-foreground text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring px-2 py-1.5"
            style={{ minHeight: '80px' }}
            spellCheck={false}
          />
        </div>
      ))}
    </div>
  );
}
