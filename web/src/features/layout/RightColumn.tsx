import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, FilePenLine } from 'lucide-react';
import { useWorkspace } from '../../context';
import { Button } from '@/components/ui/button';
import { EditorColumn } from '../editor/EditorColumn';
import { PreviewColumn } from '../preview/PreviewColumn';
import { PanelContainer } from './PanelContainer';

const MIN_EDITOR_PERCENT = 22;
const MAX_EDITOR_PERCENT = 78;

export function RightColumn() {
  const { state } = useWorkspace();
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [editorPercent, setEditorPercent] = useState(50);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const handlersRef = useRef<{ handleMove: ((e: PointerEvent) => void) | null; handleUp: (() => void) | null }>({
    handleMove: null,
    handleUp: null,
  });
  // Jobs panel is now in LeftSidebar; only show the container for sources/prompts/config
  const showPanel = state.activePanel && state.activePanel !== 'jobs';
  const showEditor = !editorCollapsed;
  const showPreview = !previewCollapsed;

  function collapseEditor() {
    if (previewCollapsed) setPreviewCollapsed(false);
    setEditorCollapsed(true);
  }

  function collapsePreview() {
    if (editorCollapsed) setEditorCollapsed(false);
    setPreviewCollapsed(true);
  }

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!showEditor || !showPreview) return;
    const container = splitRef.current;
    if (!container) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const updateFromClientX = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextPercent = ((clientX - rect.left) / rect.width) * 100;
      setEditorPercent(Math.min(MAX_EDITOR_PERCENT, Math.max(MIN_EDITOR_PERCENT, nextPercent)));
    };

    updateFromClientX(event.clientX);

    const handleMove = (moveEvent: PointerEvent) => {
      updateFromClientX(moveEvent.clientX);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      handlersRef.current.handleMove = null;
      handlersRef.current.handleUp = null;
    };

    handlersRef.current.handleMove = handleMove;
    handlersRef.current.handleUp = handleUp;

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  }, [showEditor, showPreview]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (handlersRef.current.handleMove) {
        window.removeEventListener('pointermove', handlersRef.current.handleMove);
      }
      if (handlersRef.current.handleUp) {
        window.removeEventListener('pointerup', handlersRef.current.handleUp);
      }
    };
  }, []);

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showEditor || !showPreview) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setEditorPercent((current) => Math.max(MIN_EDITOR_PERCENT, current - 4));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setEditorPercent((current) => Math.min(MAX_EDITOR_PERCENT, current + 4));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setEditorPercent(MIN_EDITOR_PERCENT);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setEditorPercent(MAX_EDITOR_PERCENT);
    }
  }, [showEditor, showPreview]);

  if (showPanel) {
    return (
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden min-h-0">
        <PanelContainer />
      </section>
    );
  }

  return (
    <section className="panel-surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.65rem] min-h-0">
      <div ref={splitRef} className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {editorCollapsed && (
          <div className="m-3 flex min-h-0 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border border-border/80 bg-white/60">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Show editor"
              onClick={() => setEditorCollapsed(false)}
            >
              <FilePenLine className="size-4" />
            </Button>
          </div>
        )}

        {showEditor && (
          <div
            className="min-h-0 min-w-0 flex"
            style={{
              flexBasis: previewCollapsed ? '100%' : `${editorPercent}%`,
              flexGrow: previewCollapsed ? 1 : 0,
              flexShrink: previewCollapsed ? 1 : 0,
            }}
          >
            <EditorColumn onCollapse={collapseEditor} />
          </div>
        )}

        {showEditor && showPreview && (
          <div
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
            aria-valuemin={MIN_EDITOR_PERCENT}
            aria-valuemax={MAX_EDITOR_PERCENT}
            aria-valuenow={Math.round(editorPercent)}
            onPointerDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
            className="group relative flex w-3 shrink-0 cursor-col-resize touch-none items-center justify-center border-x border-border/50 bg-transparent"
          >
            <div className="h-24 w-[3px] rounded-full bg-border/70 transition-colors duration-200 group-hover:bg-primary/35" />
          </div>
        )}

        {showPreview && (
          <div
            className="min-h-0 min-w-0 flex"
            style={{
              flexBasis: editorCollapsed ? '100%' : `${100 - editorPercent}%`,
              flexGrow: editorCollapsed ? 1 : 0,
              flexShrink: editorCollapsed ? 1 : 0,
            }}
          >
            <PreviewColumn onCollapse={collapsePreview} />
          </div>
        )}

        {previewCollapsed && (
          <div className="m-3 flex min-h-0 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border border-border/80 bg-white/60">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Show preview"
              onClick={() => setPreviewCollapsed(false)}
            >
              <Eye className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}