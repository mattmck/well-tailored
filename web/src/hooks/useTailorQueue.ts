import { useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import * as api from '../api/client';

export function useTailorQueue() {
  const { state, dispatch } = useWorkspace();
  const processingRef = useRef(false);
  const stateRef = useRef(state);

  stateRef.current = state;

  useEffect(() => {
    if (processingRef.current) return;
    if (state.tailorQueue.length === 0) return;
    if (state.tailorRunning !== null) return;

    const jobId = state.tailorQueue[0];
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) {
      dispatch({ type: 'SET_TAILOR_QUEUE', queue: state.tailorQueue.slice(1) });
      return;
    }
    const currentJob = job;

    processingRef.current = true;

    async function processJob() {
      dispatch({ type: 'SET_TAILOR_SUMMARY', summary: null });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: jobId });
      dispatch({ type: 'UPDATE_JOB', id: jobId, patch: { status: 'tailoring', error: null } });
      dispatch({
        type: 'SET_RUN_FEEDBACK',
        feedback: { text: `Tailoring ${currentJob.company} - ${currentJob.title}...`, type: 'working' },
      });

      let nextStatus: 'tailored' | 'error' = 'tailored';
      let nextError: string | null = null;
      let nextResult = currentJob.result;
      let nextEditorData = null;

      try {
        const body: api.ManualTailorBody = {
          resume: state.sourceResume,
          bio: state.sourceBio,
          baseCoverLetter: state.sourceCoverLetter,
          resumeSupplemental: state.sourceSupplemental,
          company: currentJob.company,
          title: currentJob.title,
          jd: currentJob.jd,
          provider: state.tailorProvider !== 'auto' ? state.tailorProvider : undefined,
          model: state.tailorModel !== 'auto' ? state.tailorModel : undefined,
          scoreProvider: state.scoreProvider !== 'auto' ? state.scoreProvider : undefined,
          scoreModel: state.scoreModel !== 'auto' ? state.scoreModel : undefined,
          prompts: state.promptSources as Record<string, string>,
        };

        const tailorResult = await api.runManualTailor(body);
        nextResult = {
          output: tailorResult.output,
          scorecard: tailorResult.scorecard,
          gapAnalysis: tailorResult.gapAnalysis,
        };

        dispatch({
          type: 'UPDATE_JOB',
          id: jobId,
          patch: {
            status: 'tailored',
            result: nextResult,
            scoresStale: false,
            _editorData: nextEditorData,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        nextStatus = 'error';
        nextError = errorMessage;
        nextResult = currentJob.result;
        dispatch({
          type: 'UPDATE_JOB',
          id: jobId,
          patch: { status: 'error', error: errorMessage },
        });
      }

      const latestState = stateRef.current;
      const nextQueue =
        latestState.tailorQueue[0] === jobId
          ? latestState.tailorQueue.slice(1)
          : latestState.tailorQueue.filter((id) => id !== jobId);

      dispatch({ type: 'SET_TAILOR_QUEUE', queue: nextQueue });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: null });

      if (nextQueue.length === 0) {
        const jobs = latestState.jobs.map((candidate) =>
          candidate.id === jobId
            ? {
                ...candidate,
                status: nextStatus,
                error: nextError,
                result: nextResult,
                scoresStale: false,
                _editorData: nextEditorData,
              }
            : candidate,
        );
        const tailored = jobs.filter((candidate) => candidate.status === 'tailored').length;
        const failed = jobs.filter((candidate) => candidate.status === 'error').length;
        dispatch({
          type: 'SET_TAILOR_SUMMARY',
          summary: { tailored, failed },
        });
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: 'Tailoring complete', type: failed > 0 ? 'error' : 'done' },
        });
      }

      processingRef.current = false;
    }

    void processJob();
  }, [
    state.tailorQueue,
    state.tailorRunning,
    state.jobs,
    state.sourceResume,
    state.sourceBio,
    state.sourceCoverLetter,
    state.sourceSupplemental,
    state.tailorProvider,
    state.tailorModel,
    state.scoreProvider,
    state.scoreModel,
    state.promptSources,
    dispatch,
  ]);
}
