import { useRef, useState } from 'react';
import type { ChangeEvent, Dispatch } from 'react';
import { Clock3, Loader2, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context';
import * as api from '../../api/client';
import type { Action } from '../../state';

type SourceField = 'sourceResume' | 'sourceBio' | 'sourceCoverLetter' | 'sourceSupplemental';

interface SourceItem {
  field: SourceField;
  label: string;
  pathKey: api.SourceKey;
}

const SOURCE_FIELDS: SourceItem[] = [
  { field: 'sourceResume', label: 'RESUME', pathKey: 'resume' },
  { field: 'sourceBio', label: 'BIO', pathKey: 'bio' },
  { field: 'sourceCoverLetter', label: 'COVER LETTER', pathKey: 'baseCoverLetter' },
  { field: 'sourceSupplemental', label: 'SUPPLEMENTAL', pathKey: 'resumeSupplemental' },
];

type BackupsByKey = Partial<Record<api.SourceKey, api.BackupEntry[]>>;

function SourceItemRow({
  item,
  value,
  filePath,
  dispatch,
  backups,
  isHistoryOpen,
  isLoadingHistory,
  onToggleHistory,
  onSaveBackup,
  onRestoreBackup,
}: {
  item: SourceItem;
  value: string;
  filePath: string | undefined;
  dispatch: Dispatch<Action>;
  backups: api.BackupEntry[] | undefined;
  isHistoryOpen: boolean;
  isLoadingHistory: boolean;
  onToggleHistory: (key: api.SourceKey) => void;
  onSaveBackup: (key: api.SourceKey, content: string) => Promise<void>;
  onRestoreBackup: (key: api.SourceKey, timestamp: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      dispatch({ type: 'SET_SOURCE', field: item.field, value: text });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleTextareaChange(e: ChangeEvent<HTMLTextAreaElement>) {
    dispatch({ type: 'SET_SOURCE', field: item.field, value: e.target.value });
  }

  const statusText = filePath
    ? `Loaded from ${filePath}`
    : value
    ? 'Loaded (edited)'
    : 'Not loaded';

  return (
    <div className="border-b border-border px-2 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </span>
          <div className="mt-1 font-mono text-[11px] leading-snug text-muted-foreground break-all">
            {filePath || (value ? '(edited in place)' : 'Not loaded')}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            title={`Upload ${item.label.toLowerCase()} file`}
          >
            <Upload size={11} strokeWidth={2} />
            <span>Upload</span>
          </button>
          <button
            onClick={() => void onSaveBackup(item.pathKey, value)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            title={`Save and backup ${item.label.toLowerCase()}`}
          >
            <Save size={11} strokeWidth={2} />
            <span>Save & backup</span>
          </button>
          <div className="relative">
            <button
              onClick={() => onToggleHistory(item.pathKey)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              title={`View ${item.label.toLowerCase()} history`}
            >
              <Clock3 size={11} strokeWidth={2} />
              <span>History</span>
            </button>

            {isHistoryOpen && (
              <div className="absolute right-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-border/80 bg-popover/95 p-2 shadow-lg backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Backups
                  </span>
                  {isLoadingHistory && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading
                    </span>
                  )}
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {backups === undefined ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      {isLoadingHistory ? 'Loading backups…' : 'Open history to load backups.'}
                    </p>
                  ) : backups.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No backups yet.</p>
                  ) : (
                    backups.map((backup) => (
                      <div
                        key={backup.timestamp}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary/40"
                      >
                        <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
                          {backup.timestamp}
                        </span>
                        <button
                          onClick={() => void onRestoreBackup(item.pathKey, backup.timestamp)}
                          className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.markdown"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground">{statusText}</div>

      <textarea
        value={value}
        onChange={handleTextareaChange}
        className="mt-2 w-full resize-y rounded border border-border bg-background p-2 text-xs font-mono leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        style={{ minHeight: '140px' }}
        placeholder={`Paste ${item.label.toLowerCase()} content here…`}
        spellCheck={false}
      />
    </div>
  );
}

export function SourcesPanel() {
  const { state, dispatch } = useWorkspace();
  const [openHistoryKey, setOpenHistoryKey] = useState<api.SourceKey | null>(null);
  const [backupsByKey, setBackupsByKey] = useState<BackupsByKey>({});
  const [loadingHistoryKey, setLoadingHistoryKey] = useState<api.SourceKey | null>(null);

  async function loadHistory(key: api.SourceKey) {
    setLoadingHistoryKey(key);
    try {
      const backups = await api.listSourceBackups(key);
      setBackupsByKey((current) => ({ ...current, [key]: backups }));
    } catch (error) {
      console.error('Failed to load source backups:', error);
    } finally {
      setLoadingHistoryKey((current) => (current === key ? null : current));
    }
  }

  async function handleToggleHistory(key: api.SourceKey) {
    if (openHistoryKey === key) {
      setOpenHistoryKey(null);
      return;
    }

    setOpenHistoryKey(key);
    if (!backupsByKey[key]) {
      await loadHistory(key);
    }
  }

  async function handleSaveBackup(key: api.SourceKey, content: string) {
    try {
      await api.backupSource(key, content);
      toast.success('Backed up');
      if (openHistoryKey === key) {
        await loadHistory(key);
      } else {
        setBackupsByKey((current) => ({ ...current, [key]: undefined }));
      }
    } catch (error) {
      console.error('Failed to save backup:', error);
      toast.error('Failed to back up source');
    }
  }

  async function handleRestoreBackup(key: api.SourceKey, timestamp: string) {
    if (!window.confirm('Restore this version? Current content will be lost.')) return;

    try {
      const content = await api.getSourceBackup(key, timestamp);
      const item = SOURCE_FIELDS.find((candidate) => candidate.pathKey === key);
      if (item) {
        dispatch({ type: 'SET_SOURCE', field: item.field, value: content });
      }
      toast.success('Restored backup');
      await loadHistory(key);
      setOpenHistoryKey(null);
    } catch (error) {
      console.error('Failed to restore backup:', error);
      toast.error('Failed to restore backup');
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {SOURCE_FIELDS.map((item) => (
        <SourceItemRow
          key={item.field}
          item={item}
          value={state[item.field]}
          filePath={state.sourcePaths[item.pathKey]}
          dispatch={dispatch}
          backups={backupsByKey[item.pathKey]}
          isHistoryOpen={openHistoryKey === item.pathKey}
          isLoadingHistory={loadingHistoryKey === item.pathKey}
          onToggleHistory={handleToggleHistory}
          onSaveBackup={handleSaveBackup}
          onRestoreBackup={handleRestoreBackup}
        />
      ))}
    </div>
  );
}
