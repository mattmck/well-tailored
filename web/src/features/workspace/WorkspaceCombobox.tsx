import { useState, useRef, useEffect } from 'react';
import { cn } from '@/components/ui/utils';

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
    <div ref={containerRef} className="relative w-64">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        className="bg-background border border-border rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {filtered.map((option) => (
            <button
              key={option.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(option.name); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                value === option.name && 'bg-accent/50'
              )}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
