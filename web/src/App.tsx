import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ExternalLink, Eye, FilePenLine, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { WorkspaceContext } from './context';
import { initialState, reducer } from './state';
import { TopBar } from './features/workspace/TopBar';
import { IconRail } from './features/layout/IconRail';
import { PanelContainer } from './features/layout/PanelContainer';
import { ScoreCards } from './features/scores/ScoreCards';
import { EditorColumn } from './features/editor/EditorColumn';
import { PreviewColumn } from './features/preview/PreviewColumn';
import { MissingKeywords } from './features/editor/MissingKeywords';
import { WorkbenchEmptyState } from './features/layout/WorkbenchEmptyState';
import { Button } from './components/ui/button';
import { useTailorQueue } from './hooks/useTailorQueue';
import { useRegradeQueue } from './hooks/useRegradeQueue';
import * as api from './api/client';

type PaneMode = 'docked' | 'hidden' | 'popout';

function copyDocumentStyles(targetDocument: Document) {
  targetDocument.head.innerHTML = '';
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    targetDocument.head.appendChild(node.cloneNode(true));
  }
}

function PopoutWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const popup = window.open('', '', 'popup=yes,width=1200,height=900,resizable=yes,scrollbars=yes');
    if (!popup) {
      onClose();
      return undefined;
    }

    popup.document.title = title;
    copyDocumentStyles(popup.document);
    popup.document.body.className = document.body.className;
    popup.document.body.innerHTML = '';

    const mountNode = popup.document.createElement('div');
    mountNode.style.height = '100vh';
    popup.document.body.appendChild(mountNode);
    setContainer(mountNode);

    const handleBeforeUnload = () => onClose();
    popup.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      popup.removeEventListener('beforeunload', handleBeforeUnload);
      if (!popup.closed) popup.close();
    };
  }, [onClose, title]);

  if (!container) return null;
  return createPortal(children, container);
}

function AppShell() {
  useTailorQueue();
  useRegradeQueue();
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  ));
  const [editorMode, setEditorMode] = useState<PaneMode>('docked');
  const [previewMode, setPreviewMode] = useState<PaneMode>('docked');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsDesktop(event?.matches ?? mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const showDockedEditor = editorMode === 'docked';
  const showDockedPreview = previewMode === 'docked';

  const editorControls = useMemo(() => (
    <>
      {previewMode !== 'docked' && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setPreviewMode('docked')}
          title={previewMode === 'hidden' ? 'Show preview' : 'Dock preview'}
          aria-label={previewMode === 'hidden' ? 'Show preview' : 'Dock preview'}
        >
          <PanelRightOpen className="size-3.5" />
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setEditorMode('hidden')}
        title="Hide editor"
        aria-label="Hide editor"
      >
        <Eye className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setEditorMode('popout')}
        title="Pop out editor"
        aria-label="Pop out editor"
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </>
  ), [previewMode]);

  const previewControls = useMemo(() => (
    <>
      {editorMode !== 'docked' && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setEditorMode('docked')}
          title={editorMode === 'hidden' ? 'Show editor' : 'Dock editor'}
          aria-label={editorMode === 'hidden' ? 'Show editor' : 'Dock editor'}
        >
          <PanelLeftOpen className="size-3.5" />
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setPreviewMode('hidden')}
        title="Hide preview"
        aria-label="Hide preview"
      >
        <Eye className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setPreviewMode('popout')}
        title="Pop out preview"
        aria-label="Pop out preview"
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </>
  ), [editorMode]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="h-full px-3 pb-3 pt-4 sm:px-5 sm:pb-5">
        <div className="desk-shell page-enter mx-auto flex h-full max-w-[1880px] min-h-0 flex-col rounded-[2rem] p-3 sm:p-4">
          <div className="shell-surface relative z-10 flex min-h-0 flex-1 flex-col rounded-[1.7rem]">
            <div className={`flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-4 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-auto'}`}>
              <IconRail />
              <PanelContainer />

              <main className={`flex min-w-0 flex-1 flex-col min-h-0 ${isDesktop ? 'overflow-hidden' : ''}`}>
                <TopBar />

                <div className={`flex min-w-0 flex-1 gap-3 min-h-0 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col'}`}>
                  <section className={`panel-surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.65rem] ${isDesktop ? 'min-h-0' : 'min-h-[36rem]'}`}>
                    <ScoreCards />

                    <div className="flex flex-1 min-h-0 overflow-hidden px-3 pb-3">
                      <div className="paper-pane flex min-h-0 flex-1 overflow-hidden rounded-[1.45rem]">
                        {showDockedEditor && showDockedPreview ? (
                          <PanelGroup direction={isDesktop ? 'horizontal' : 'vertical'} className="flex-1 overflow-hidden min-h-0">
                            <Panel
                              defaultSize={45}
                              minSize={0}
                              collapsible
                              collapsedSize={0}
                              className="min-h-0 min-w-0 flex"
                            >
                              <div className="h-full min-h-0 flex w-full">
                                <EditorColumn layoutControls={editorControls} />
                              </div>
                            </Panel>

                            <PanelResizeHandle className={`group relative flex items-center justify-center bg-transparent ${isDesktop ? 'mx-1 w-4' : 'my-1 h-4'}`}>
                              <div className={`${isDesktop ? 'h-24 w-[3px]' : 'h-[3px] w-24'} rounded-full bg-border/90 transition-colors duration-200 group-hover:bg-primary/35`} />
                            </PanelResizeHandle>

                            <Panel
                              defaultSize={55}
                              minSize={0}
                              collapsible
                              collapsedSize={0}
                              className="min-h-0 min-w-0 flex"
                            >
                              <div className="h-full min-h-0 flex w-full">
                                <PreviewColumn layoutControls={previewControls} />
                              </div>
                            </Panel>
                          </PanelGroup>
                        ) : showDockedEditor ? (
                          <div className="flex h-full min-h-0 w-full">
                            <EditorColumn layoutControls={editorControls} />
                          </div>
                        ) : showDockedPreview ? (
                          <div className="flex h-full min-h-0 w-full">
                            <PreviewColumn layoutControls={previewControls} />
                          </div>
                        ) : (
                          <div className="flex h-full w-full p-4">
                            <WorkbenchEmptyState
                              className="w-full"
                              eyebrow="Workspace Layout"
                              title="Editor and preview are out of the dock."
                              description="Bring either pane back into the main workspace, or keep working with the pop-out windows."
                              icon={FilePenLine}
                              tips={[
                                'Use Show Editor to restore the drafting pane here.',
                                'Use Show Preview to restore the review pane here.',
                              ]}
                              actions={(
                                <div className="flex flex-wrap gap-2">
                                  {editorMode !== 'docked' && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setEditorMode('docked')}>
                                      <PanelLeftOpen className="size-3.5" />
                                      {editorMode === 'hidden' ? 'Show Editor' : 'Dock Editor'}
                                    </Button>
                                  )}
                                  {previewMode !== 'docked' && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPreviewMode('docked')}>
                                      <PanelRightOpen className="size-3.5" />
                                      {previewMode === 'hidden' ? 'Show Preview' : 'Dock Preview'}
                                    </Button>
                                  )}
                                </div>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <MissingKeywords />
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>

      {editorMode === 'popout' && (
        <PopoutWindow title="Well-Tailored Editor" onClose={() => setEditorMode('docked')}>
          <div className="h-screen overflow-hidden bg-background p-3 text-foreground">
            <div className="shell-surface flex h-full min-h-0 flex-col rounded-[1.7rem]">
              <EditorColumn
                layoutControls={(
                  <>
                    {previewMode !== 'docked' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPreviewMode('docked')}
                        title={previewMode === 'hidden' ? 'Show preview' : 'Dock preview'}
                        aria-label={previewMode === 'hidden' ? 'Show preview' : 'Dock preview'}
                      >
                        <PanelRightOpen className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditorMode('docked')}
                      title="Dock editor"
                      aria-label="Dock editor"
                    >
                      <PanelLeftOpen className="size-3.5" />
                    </Button>
                  </>
                )}
              />
            </div>
          </div>
        </PopoutWindow>
      )}

      {previewMode === 'popout' && (
        <PopoutWindow title="Well-Tailored Preview" onClose={() => setPreviewMode('docked')}>
          <div className="h-screen overflow-hidden bg-background p-3 text-foreground">
            <div className="shell-surface flex h-full min-h-0 flex-col rounded-[1.7rem]">
              <PreviewColumn
                layoutControls={(
                  <>
                    {editorMode !== 'docked' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setEditorMode('docked')}
                        title={editorMode === 'hidden' ? 'Show editor' : 'Dock editor'}
                        aria-label={editorMode === 'hidden' ? 'Show editor' : 'Dock editor'}
                      >
                        <PanelLeftOpen className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setPreviewMode('docked')}
                      title="Dock preview"
                      aria-label="Dock preview"
                    >
                      <PanelRightOpen className="size-3.5" />
                    </Button>
                  </>
                )}
              />
            </div>
          </div>
        </PopoutWindow>
      )}
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      const providers = cfg.options.providers.map((p) => ({
        id: p.id,
        name: p.label,
        models: p.models,
      }));
      dispatch({
        type: 'INITIALIZE_CONFIG',
        providers,
        defaults: cfg.defaults,
      });
    }).catch(console.error);

    api.getLocalWorkspace().then((ws) => {
      const docs = ws.documents || {} as Record<string, string>;
      dispatch({ type: 'SET_SOURCE', field: 'sourceResume', value: docs.resume || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceBio', value: docs.bio || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceCoverLetter', value: docs.baseCoverLetter || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceSupplemental', value: docs.resumeSupplemental || '' });
      dispatch({ type: 'SET_SOURCE_PATHS', paths: ws.paths || {} });
      dispatch({ type: 'SET_PROMPT_SOURCES', sources: ws.prompts || {} });
    }).catch(console.error);

    api.listWorkspaces().then((res) => {
      dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: res.workspaces });
    }).catch(console.error);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </WorkspaceContext.Provider>
  );
}
