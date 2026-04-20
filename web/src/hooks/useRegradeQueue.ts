import { useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import * as api from '../api/client';
import { getJobDocumentsForRegrade } from '../lib/job-documents.js';

export function useRegradeQueue() {
  const { state, dispatch } = useWorkspace();
  const processingRef = useRef(false);
  const stateRef = useRef(state);
  const hadFailureRef = useRef(false);

  stateRef.current = state;

  useEffect(() => {
    if (processingRef.current) return;
    if (state.regradeQueue.length === 0) return;
    if (state.regradeRunning !== null) return;

    const jobId = state.regradeQueue[0];
    const job = state.jobs.find((candidate) => candidate.id === jobId);
    if (!job?.result) {
      dispatch({ type: 'SET_REGRADE_QUEUE', queue: state.regradeQueue.slice(1) });
      return;
    }
    const currentJob = job;
    const currentResult = job.result;

    if (state.regradeQueue.length === state.regradeQueueTotal) {
      hadFailureRef.current = false;
    }

    processingRef.current = true;

    async function processJob() {
      dispatch({ type: 'SET_REGRADE_RUNNING', id: jobId });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Re-scoring ${currentJob.company} — ${currentJob.title || 'role'}.`,
        logType: 'working',
      });
      console.info('[workbench] Starting re-grade', {
        jobId,
        company: currentJob.company,
        title: currentJob.title,
      });

      const documents = getJobDocumentsForRegrade(currentJob);
      if (!documents) {
        const latestQueue = stateRef.current.regradeQueue;
        const nextQueue =
          latestQueue[0] === jobId
            ? latestQueue.slice(1)
            : latestQueue.filter((id) => id !== jobId);
        hadFailureRef.current = true;
        console.error('Re-grade skipped: no documents available for job', currentJob.id);
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: `Re-grade skipped for ${currentJob.company}: no documents available`, type: 'error' },
        });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Skipped re-grade for ${currentJob.company}: no documents available.`,
          logType: 'error',
        });
        dispatch({ type: 'SET_REGRADE_QUEUE', queue: nextQueue });
        dispatch({ type: 'SET_REGRADE_RUNNING', id: null });
        processingRef.current = false;
        return;
      }

      try {
        const [scorecard, gapAnalysis] = await Promise.all([
          api.getScore({
            resume: documents.resume,
            jd: currentJob.jd,
            coverLetter: documents.coverLetter,
            company: currentJob.company,
            jobTitle: currentJob.title,
            provider: state.scoreProvider !== 'auto' ? state.scoreProvider : undefined,
            model: state.scoreModel !== 'auto' ? state.scoreModel : undefined,
          }),
          api.getGapAnalysis({
            resume: documents.resume,
            jd: currentJob.jd,
          }),
        ]);

        dispatch({
          type: 'UPDATE_JOB',
          id: currentJob.id,
          patch: {
            error: null,
            scoresStale: false,
            result: {
              ...currentResult,
              output: {
                ...currentResult.output,
                ...documents,
              },
              scorecard,
              gapAnalysis,
            },
          },
        });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Updated scorecard and keyword gap for ${currentJob.company}.`,
          logType: 'done',
        });
        console.info('[workbench] Re-grade complete', { jobId: currentJob.id, company: currentJob.company });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        hadFailureRef.current = true;
        console.error('Re-grade failed:', err);
        dispatch({
          type: 'UPDATE_JOB',
          id: currentJob.id,
          patch: { error: errorMessage },
        });
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: `Re-grade failed for ${currentJob.company}`, type: 'error' },
        });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Re-grade failed for ${currentJob.company}: ${errorMessage}`,
          logType: 'error',
        });
      }

      const latestState = stateRef.current;
      const nextQueue =
        latestState.regradeQueue[0] === jobId
          ? latestState.regradeQueue.slice(1)
          : latestState.regradeQueue.filter((id) => id !== jobId);

      dispatch({ type: 'SET_REGRADE_QUEUE', queue: nextQueue });
      dispatch({ type: 'SET_REGRADE_RUNNING', id: null });

      if (nextQueue.length === 0) {
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: {
            text: hadFailureRef.current ? 'Re-grading finished with errors' : 'Re-grading complete',
            type: hadFailureRef.current ? 'error' : 'done',
          },
        });
      }

      processingRef.current = false;
    }

    void processJob();
  }, [
    state.regradeQueue,
    state.regradeRunning,
    state.jobs,
    state.scoreProvider,
    state.scoreModel,
    dispatch,
  ]);
}
