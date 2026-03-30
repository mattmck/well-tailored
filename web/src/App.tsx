import { useEffect, useReducer, useState } from 'react';
import { Toaster } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { WorkspaceContext } from './context';
import { initialState, reducer } from './state';
import { TopBar } from './features/workspace/TopBar';
import { IconRail } from './features/layout/IconRail';
import { PanelContainer } from './features/layout/PanelContainer';
import { ScoreCards } from './features/scores/ScoreCards';
import { EditorColumn } from './features/editor/EditorColumn';
import { PreviewColumn } from './features/preview/PreviewColumn';
import { MissingKeywords } from './features/editor/MissingKeywords';
import { useTailorQueue } from './hooks/useTailorQueue';
import { useRegradeQueue } from './hooks/useRegradeQueue';
import * as api from './api/client';

function AppShell() {
  useTailorQueue();
  useRegradeQueue();
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  ));

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

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="h-full px-3 pb-3 pt-4 sm:px-5 sm:pb-5">
        <div className="desk-shell page-enter mx-auto flex h-full max-w-[1880px] min-h-0 flex-col rounded-[2rem] p-3 sm:p-4">
          <div className="shell-surface relative z-10 flex min-h-0 flex-1 flex-col rounded-[1.7rem]">
            <TopBar />

            <div className={`flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-4 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-auto'}`}>
              <IconRail />
              <PanelContainer />

              <main className={`flex min-w-0 flex-1 gap-3 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col'}`}>
                <section className={`panel-surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.65rem] ${isDesktop ? 'min-h-0' : 'min-h-[36rem]'}`}>
                  <ScoreCards />

                  <div className="flex flex-1 min-h-0 overflow-hidden px-3 pb-3">
                    <div className="paper-pane flex min-h-0 flex-1 overflow-hidden rounded-[1.45rem]">
                      <PanelGroup direction={isDesktop ? 'horizontal' : 'vertical'} className="flex-1 overflow-hidden min-h-0">
                        <Panel defaultSize={50} minSize={30} className="min-h-0 min-w-0 flex">
                          <div className="h-full min-h-0 flex w-full">
                            <EditorColumn />
                          </div>
                        </Panel>

                        <PanelResizeHandle className={`group relative flex items-center justify-center bg-transparent ${isDesktop ? 'mx-1 w-4' : 'my-1 h-4'}`}>
                          <div className={`${isDesktop ? 'h-24 w-[3px]' : 'h-[3px] w-24'} rounded-full bg-border/90 transition-colors duration-200 group-hover:bg-primary/35`} />
                        </PanelResizeHandle>

                        <Panel defaultSize={50} minSize={30} className="min-h-0 min-w-0 flex">
                          <div className="h-full min-h-0 flex w-full">
                            <PreviewColumn />
                          </div>
                        </Panel>
                      </PanelGroup>
                    </div>
                  </div>
                </section>

                <MissingKeywords />
              </main>
            </div>
          </div>
        </div>
      </div>
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
