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
          {/* Label */}
          <div
            className="text-muted-foreground font-medium tracking-wider mb-1"
            style={{ fontSize: '11px', textTransform: 'uppercase' }}
          >
            {field.label}
          </div>

          {/* Source label */}
          <div className="text-xs text-muted-foreground mb-1.5">
            {getSourceLabel(field.key)}
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileRefs.current[field.key]?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 mb-2 hover:bg-secondary/50 transition-colors"
          >
            <Upload size={12} strokeWidth={2} />
            Upload prompt file
          </button>

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
