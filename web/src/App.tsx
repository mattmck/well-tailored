import { useReducer, useEffect } from 'react';
import { WorkspaceContext } from './context';
import { initialState, reducer } from './state';
import { TopBar } from './features/workspace/TopBar';
import { IconRail } from './features/layout/IconRail';
import { PanelContainer } from './features/layout/PanelContainer';
import { ScoreCards } from './features/scores/ScoreCards';
import { EditorColumn } from './features/editor/EditorColumn';
import * as api from './api/client';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      dispatch({ type: 'SET_CONFIG_PROVIDERS', providers: cfg.providers });
    }).catch(console.error);

    api.getLocalWorkspace().then((ws) => {
      dispatch({ type: 'SET_SOURCE', field: 'sourceResume', value: ws.resume || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceBio', value: ws.bio || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceCoverLetter', value: ws.baseCoverLetter || '' });
      dispatch({ type: 'SET_SOURCE', field: 'sourceSupplemental', value: ws.resumeSupplemental || '' });
      dispatch({ type: 'SET_SOURCE_PATHS', paths: ws.paths || {} });
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
            <div className="flex-1 flex overflow-hidden min-h-0">
              <EditorColumn />
              {/* PreviewColumn goes here in Task 12 */}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
