import { useCallback, useEffect, useReducer, useState } from 'react';
import { Toaster } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { WorkspaceContext, useWorkspace } from './context';
import { initialState, reducer } from './state';
import { TopBar } from './features/workspace/TopBar';
import { LeftSidebar } from './features/layout/LeftSidebar';
import { RightColumn } from './features/layout/RightColumn';
import { useTailorQueue } from './hooks/useTailorQueue';
import { useRegradeQueue } from './hooks/useRegradeQueue';
import { useTaskPolling } from './hooks/useTaskPolling';
import { useEditorAutoSave } from './hooks/useEditorAutoSave';
import { normalizeTailorResult } from './lib/result-normalizers';
import { getTailorTaskMetadata } from './lib/tasks';
import { workspaceRecordToState } from './features/workspace/workspacePersistence';
import type { TaskRecord } from './api/client';
import * as api from './api/client';

function AppShell() {
  useTailorQueue();
  useRegradeQueue();
  useEditorAutoSave();

  const { state, dispatch } = useWorkspace();

  const handleTaskCompleted = useCallback((task: TaskRecord) => {
    if (task.type !== 'tailor') return;
    try {
      const input = getTailorTaskMetadata(task);
      const frontendJobId = input.frontendJobId;
      const jobLabel = `${input.company ?? 'selected company'}${input.jobTitle ? ` — ${input.jobTitle}` : ''}`;
      const rawResult = JSON.parse(task.resultJson ?? 'null');
      const result = normalizeTailorResult(rawResult);
      dispatch({
        type: 'UPDATE_JOB',
        id: frontendJobId,
        patch: {
          status: result ? 'tailored' : 'error',
          dbJobId: task.jobId,
          result: result ?? null,
          scoresStale: false,
          error: result ? null : 'Tailoring produced no output',
        },
      });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
      dispatch({
        type: 'SET_RUN_FEEDBACK',
        feedback: { text: 'Tailoring complete', type: 'done' },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: result
          ? `Finished tailoring ${jobLabel}. Resume and cover letter are ready.`
          : `Tailoring finished for ${jobLabel}, but no output was returned.`,
        logType: result ? 'done' : 'error',
      });
      console.info('[workbench] Tailoring task completed', {
        taskId: task.id,
        frontendJobId,
        hasResult: Boolean(result),
      });
    } catch (err) {
      console.error('Failed to parse task result:', err);
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Could not read completed tailoring task ${task.id}: ${err instanceof Error ? err.message : String(err)}`,
        logType: 'error',
      });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
    }
  }, [dispatch]);

  const handleTaskFailed = useCallback((task: TaskRecord) => {
    if (task.type !== 'tailor') return;
    try {
      const input = getTailorTaskMetadata(task);
      const frontendJobId = input.frontendJobId;
      const jobLabel = `${input.company ?? 'selected company'}${input.jobTitle ? ` — ${input.jobTitle}` : ''}`;
      dispatch({
        type: 'UPDATE_JOB',
        id: frontendJobId,
        patch: { status: 'error', error: task.error ?? 'Tailoring failed' },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Tailoring failed for ${jobLabel}: ${task.error ?? 'unknown error'}`,
        logType: 'error',
      });
      console.error('[workbench] Tailoring task failed', {
        taskId: task.id,
        frontendJobId,
        error: task.error,
      });
    } catch {
      // ignore parse errors
    }
    dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
    dispatch({
      type: 'SET_RUN_FEEDBACK',
      feedback: { text: 'Tailoring failed', type: 'error' },
    });
  }, [dispatch]);

  const handleActiveTask = useCallback((task: TaskRecord) => {
    if (task.type !== 'tailor') return;
    if (state.tailorRunning) return;
    try {
      const input = getTailorTaskMetadata(task);
      const frontendJobId = input.frontendJobId;
      const jobLabel = `${input.company ?? 'selected company'}${input.jobTitle ? ` — ${input.jobTitle}` : ''}`;
      const startedAt = Date.parse(task.updatedAt) || Date.parse(task.createdAt) || Date.now();
      dispatch({ type: 'SET_TAILOR_RUNNING', id: frontendJobId, startedAt });
      dispatch({
        type: 'UPDATE_JOB',
        id: frontendJobId,
        patch: { status: 'tailoring', dbJobId: task.jobId },
      });
      dispatch({
        type: 'SET_RUN_FEEDBACK',
        feedback: { text: `Tailoring ${jobLabel}…`, type: 'working' },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Resumed tracking in-flight tailoring for ${jobLabel}.`,
        logType: 'working',
      });
      console.info('[workbench] Resumed tracking active tailoring task', {
        taskId: task.id,
        frontendJobId,
        status: task.status,
      });
    } catch (err) {
      console.warn('[workbench] Could not rehydrate active task', err);
    }
  }, [dispatch, state.tailorRunning]);

  useTaskPolling({
    workspaceId: state.activeWorkspaceId,
    onTaskCompleted: handleTaskCompleted,
    onTaskFailed: handleTaskFailed,
    onActiveTask: handleActiveTask,
  });

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

            <div className={`flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-2 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-auto'}`}>
              {isDesktop ? (
                <PanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
                  {/* Left sidebar */}
                  <Panel defaultSize={22} minSize={18} maxSize={35} className="min-h-0 min-w-0 flex flex-col">
                    <LeftSidebar />
                  </Panel>

                  <PanelResizeHandle className="group relative flex items-center justify-center bg-transparent mx-1 w-4">
                    <div className="h-24 w-[3px] rounded-full bg-border/90 transition-colors duration-200 group-hover:bg-primary/35" />
                  </PanelResizeHandle>

                  {/* Right editor/preview column */}
                  <Panel defaultSize={78} minSize={50} className="min-h-0 min-w-0 flex flex-col">
                    <RightColumn />
                  </Panel>
                </PanelGroup>
              ) : (
                <>
                  <LeftSidebar />
                  <RightColumn />
                </>
              )}
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
        dbPath: cfg.persistence?.dbPath,
      });
    }).catch(console.error);

    async function initializeWorkspace() {
      try {
        const res = await api.listWorkspaces();
        dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: res.workspaces });

        const latestWorkspace = res.workspaces[0];
        if (latestWorkspace) {
          const data = await api.loadWorkspace(latestWorkspace.id);
          dispatch({ type: 'LOAD_WORKSPACE', state: workspaceRecordToState(data) });
          dispatch({
            type: 'ADD_ACTIVITY_LOG',
            message: `Loaded latest DB workspace "${latestWorkspace.name}".`,
            logType: 'done',
          });
          console.info('[workbench] Loaded latest DB workspace on startup', {
            id: latestWorkspace.id,
            name: latestWorkspace.name,
          });
          return;
        }

        const ws = await api.getLocalWorkspace();
        const docs = ws.documents || {} as Record<string, string>;
        dispatch({ type: 'SET_SOURCE', field: 'sourceResume', value: docs.resume || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceBio', value: docs.bio || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceCoverLetter', value: docs.baseCoverLetter || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceSupplemental', value: docs.resumeSupplemental || '' });
        dispatch({ type: 'SET_SOURCE_PATHS', paths: ws.paths || {} });
        dispatch({ type: 'SET_PROMPT_SOURCES', sources: ws.prompts || {} });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: 'No DB workspace found; loaded local source files.',
          logType: 'info',
        });
      } catch (err) {
        console.error('Failed to initialize workspace:', err);
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Workspace initialization failed: ${err instanceof Error ? err.message : String(err)}`,
          logType: 'error',
        });
      }
    }

    void initializeWorkspace();
  }, []);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </WorkspaceContext.Provider>
  );
}
