import { useState, useRef, useEffect } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Input } from '@/components/ui/input';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (name: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
}

export function WorkspaceCombobox({ value, onChange, onSelect, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(value.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(name: string) {
    onSelect(name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-[15rem] max-w-[26rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/80" />
      <Input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        className="h-11 rounded-[1rem] pl-10 pr-10"
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/70" />

      {open && (
        <div className="panel-surface absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.1rem] border border-border/80 p-1.5">
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                key={option.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(option.name); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-[0.9rem] px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent/75 hover:text-accent-foreground',
                  value === option.name && 'bg-accent/55'
                )}
              >
                <span className="truncate">{option.name}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Saved
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No matching workspaces yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
