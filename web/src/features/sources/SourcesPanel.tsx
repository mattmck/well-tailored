import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { Action } from '../../state';
import { getSourceStatusLabel } from './sourceStatus.js';
import { MarkdownEditor } from '@/components/MarkdownEditor';

type SourceField = 'sourceResume' | 'sourceBio' | 'sourceCoverLetter' | 'sourceSupplemental';

interface SourceItem {
  field: SourceField;
  label: string;
  pathKey: 'resume' | 'bio' | 'baseCoverLetter' | 'resumeSupplemental';
}

const SOURCE_FIELDS: SourceItem[] = [
  { field: 'sourceResume', label: 'RESUME', pathKey: 'resume' },
  { field: 'sourceBio', label: 'BIO', pathKey: 'bio' },
  { field: 'sourceCoverLetter', label: 'COVER LETTER', pathKey: 'baseCoverLetter' },
  { field: 'sourceSupplemental', label: 'SUPPLEMENTAL', pathKey: 'resumeSupplemental' },
];

function SourceItemRow({
  item,
  value,
  filePath,
  hasSavedWorkspace,
  dispatch,
}: {
  item: SourceItem;
  value: string;
  filePath: string | undefined;
  hasSavedWorkspace: boolean;
  dispatch: React.Dispatch<Action>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      dispatch({ type: 'SET_SOURCE', field: item.field, value: text });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded
    e.target.value = '';
  }

  function handleValueChange(next: string) {
    dispatch({ type: 'SET_SOURCE', field: item.field, value: next });
  }

  const statusText = getSourceStatusLabel({
    filePath,
    value,
    hasSavedWorkspace,
  });

  return (
    <div className="border-b border-border" style={{ padding: '10px 8px' }}>
      {/* Header row: label + upload button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.label}
        </span>
        <button
          onClick={handleUploadClick}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-secondary/50"
          title={`Upload ${item.label.toLowerCase()} file`}
        >
          <Upload size={11} strokeWidth={2} />
          <span>Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="font-mono text-[11px] text-muted-foreground mb-2 break-all leading-snug">
        {statusText}
      </div>

      <MarkdownEditor
        value={value}
        onChange={handleValueChange}
        placeholder={`Paste ${item.label.toLowerCase()} content here…`}
        ariaLabel={item.label}
      />
    </div>
  );
}

export function SourcesPanel() {
  const { state, dispatch } = useWorkspace();
  const hasSavedWorkspace = Boolean(state.activeWorkspaceId);

  return (
    <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
      {SOURCE_FIELDS.map((item) => (
        <SourceItemRow
          key={item.field}
          item={item}
          value={state[item.field]}
          filePath={state.sourcePaths[item.pathKey]}
          hasSavedWorkspace={hasSavedWorkspace}
          dispatch={dispatch}
        />
      ))}
    </div>
  );
}
