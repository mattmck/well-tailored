import { useReducer, useEffect } from 'react';
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
import * as api from './api/client';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      const providers = cfg.options.providers.map((p) => ({
        id: p.id,
        name: p.label,
        models: p.models,
      }));
      dispatch({ type: 'SET_CONFIG_PROVIDERS', providers });
    }).catch(console.error);

    api.getLocalWorkspace().then((ws) => {
      const docs = ws.documents || {} as Record<string, string>;
      dispatch({ type: 'SET_SOURCE', field: 'sourceResume', value: docs.resume || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceBio', value: docs.bio || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceCoverLetter', value: docs.baseCoverLetter || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceSupplemental', value: docs.resumeSupplemental || '' });
      dispatch({ type: 'SET_PROMPT_SOURCES', sources: ws.prompts || {} });
    }).catch(console.error);

    api.listWorkspaces().then((res) => {
      dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: res.workspaces });
    }).catch(console.error);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <IconRail />
          <PanelContainer />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ScoreCards />
            <PanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
              <Panel defaultSize={50} minSize={30}>
                <EditorColumn />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
              <Panel defaultSize={50} minSize={30}>
                <PreviewColumn />
              </Panel>
            </PanelGroup>
            <MissingKeywords />
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
