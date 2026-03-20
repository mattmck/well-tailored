import { useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import * as api from '../api/client';

export function useTailorQueue() {
  const { state, dispatch } = useWorkspace();
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    if (state.tailorQueue.length === 0) return;
    if (state.tailorRunning !== null) return;

    const jobId = state.tailorQueue[0];
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) {
      // Job not found, remove from queue
      dispatch({ type: 'SET_TAILOR_QUEUE', queue: state.tailorQueue.slice(1) });
      return;
    }

    processingRef.current = true;

    async function processJob() {
      dispatch({ type: 'SET_TAILOR_RUNNING', id: jobId });
      dispatch({ type: 'UPDATE_JOB', id: jobId, patch: { status: 'tailoring', error: null } });
      dispatch({
        type: 'SET_RUN_FEEDBACK',
        feedback: { text: `Tailoring ${job!.company} - ${job!.title}...`, type: 'working' },
      });

      try {
        const body: api.ManualTailorBody = {
          resume: state.sourceResume,
          bio: state.sourceBio,
          baseCoverLetter: state.sourceCoverLetter,
          resumeSupplemental: state.sourceSupplemental,
          company: job!.company,
          title: job!.title,
          jd: job!.jd,
          provider: state.tailorProvider !== 'auto' ? state.tailorProvider : undefined,
          model: state.tailorModel !== 'auto' ? state.tailorModel : undefined,
          scoreProvider: state.scoreProvider !== 'auto' ? state.scoreProvider : undefined,
          scoreModel: state.scoreModel !== 'auto' ? state.scoreModel : undefined,
          prompts: state.promptSources as Record<string, string>,
        };

        const tailorResult = await api.runManualTailor(body);

        // Run gap analysis on the tailored resume
        let gapAnalysis;
        try {
          gapAnalysis = await api.getGapAnalysis({
            resume: tailorResult.output.resume,
            jd: job!.jd,
          });
        } catch {
          // Gap analysis is non-critical, continue without it
        }

        dispatch({
          type: 'UPDATE_JOB',
          id: jobId,
          patch: {
            status: 'tailored',
            result: {
              output: tailorResult.output,
              scorecard: tailorResult.scorecard,
              gapAnalysis,
            },
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        dispatch({
          type: 'UPDATE_JOB',
          id: jobId,
          patch: { status: 'error', error: errorMessage },
        });
      }

      // Remove processed job from queue
      const nextQueue = state.tailorQueue.slice(1);
      dispatch({ type: 'SET_TAILOR_QUEUE', queue: nextQueue });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: null });

      if (nextQueue.length === 0) {
        const jobs = state.jobs;
        const tailored = jobs.filter((j) => j.status === 'tailored').length;
        const failed = jobs.filter((j) => j.status === 'error').length;
        dispatch({
          type: 'SET_TAILOR_SUMMARY',
          summary: { tailored, failed },
        });
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: 'Tailoring complete', type: 'done' },
        });
      }

      processingRef.current = false;
    }

    processJob();
  }, [state.tailorQueue, state.tailorRunning, state.jobs, state.sourceResume, state.sourceBio, state.sourceCoverLetter, state.sourceSupplemental, state.tailorProvider, state.tailorModel, state.scoreProvider, state.scoreModel, state.promptSources, dispatch]);

  function enqueueJobs(jobIds: string[]) {
    dispatch({ type: 'SET_TAILOR_QUEUE', queue: jobIds });
  }

  return {
    enqueueJobs,
    isProcessing: state.tailorRunning !== null,
  };
}
