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
        feedback: { text: `Creating tailoring task for ${currentJob.company}`, type: 'working' },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Preparing ${currentJob.company} — ${currentJob.title || 'role'} for tailoring.`,
        logType: 'working',
      });
      console.info('[workbench] Preparing tailoring task', {
        frontendJobId: jobId,
        company: currentJob.company,
        title: currentJob.title,
      });

      try {
        // Ensure a DB workspace exists for this session
        let workspaceId = stateRef.current.activeWorkspaceId;
        if (!workspaceId) {
          const wsName = stateRef.current.workspaceName.trim() || 'Default';
          const ws = await api.createWorkspace({
            name: wsName,
            sourceResume: stateRef.current.sourceResume,
            sourceBio: stateRef.current.sourceBio,
            sourceCoverLetter: stateRef.current.sourceCoverLetter,
            sourceSupplemental: stateRef.current.sourceSupplemental,
            promptResumeSystem: stateRef.current.promptSources.resumeSystem ?? '',
            promptCoverLetterSystem: stateRef.current.promptSources.coverLetterSystem ?? '',
            promptScoringSystem: stateRef.current.promptSources.scoringSystem ?? '',
            agentConfigJson: JSON.stringify({
              tailoringProvider: stateRef.current.tailorProvider,
              tailoringModel: stateRef.current.tailorModel,
              scoringProvider: stateRef.current.scoreProvider,
              scoringModel: stateRef.current.scoreModel,
            }),
          });
          workspaceId = ws.id;
          dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: ws.id });
          dispatch({ type: 'SET_WORKSPACE_NAME', name: ws.name });
          dispatch({
            type: 'ADD_ACTIVITY_LOG',
            message: `Created workspace "${ws.name}" for queued jobs.`,
            logType: 'done',
          });
          console.info('[workbench] Created workspace for tailoring', { workspaceId: ws.id, name: ws.name });
        } else {
          await api.updateWorkspace(workspaceId, {
            sourceResume: stateRef.current.sourceResume,
            sourceBio: stateRef.current.sourceBio,
            sourceCoverLetter: stateRef.current.sourceCoverLetter,
            sourceSupplemental: stateRef.current.sourceSupplemental,
            promptResumeSystem: stateRef.current.promptSources.resumeSystem ?? '',
            promptCoverLetterSystem: stateRef.current.promptSources.coverLetterSystem ?? '',
            promptScoringSystem: stateRef.current.promptSources.scoringSystem ?? '',
            agentConfigJson: JSON.stringify({
              tailoringProvider: stateRef.current.tailorProvider,
              tailoringModel: stateRef.current.tailorModel,
              scoringProvider: stateRef.current.scoreProvider,
              scoringModel: stateRef.current.scoreModel,
            }),
          });
        }

        const jobPayload = {
          company: currentJob.company,
          title: currentJob.title || undefined,
          jd: currentJob.jd || undefined,
          stage: currentJob.stage || 'wishlist',
          source: currentJob.source ?? (currentJob.stage === 'manual' ? 'manual' : 'huntr'),
          huntrId: currentJob.huntrId ?? (currentJob.source === 'manual' ? undefined : currentJob.id),
          listAddedAt: currentJob.listAddedAt ?? null,
        };

        let dbJobId = currentJob.dbJobId;
        if (dbJobId) {
          const updatedJob = await api.updateJob(workspaceId, dbJobId, jobPayload);
          dbJobId = updatedJob.id;
          dispatch({
            type: 'UPDATE_JOB',
            id: jobId,
            patch: {
              dbJobId: updatedJob.id,
              huntrId: updatedJob.huntrId
                ?? currentJob.huntrId
                ?? (currentJob.source === 'manual' ? null : currentJob.id),
            },
          });
          console.info('[workbench] Updated existing DB job for tailoring', {
            frontendJobId: jobId,
            dbJobId: updatedJob.id,
            workspaceId,
          });
        } else {
          const dbJob = await api.createJob(workspaceId, jobPayload);
          dbJobId = dbJob.id;
          console.info('[workbench] Created DB job for tailoring', {
            frontendJobId: jobId,
            dbJobId: dbJob.id,
            workspaceId,
          });
          dispatch({
            type: 'UPDATE_JOB',
            id: jobId,
            patch: {
              dbJobId: dbJob.id,
              huntrId: dbJob.huntrId
                ?? currentJob.huntrId
                ?? (currentJob.source === 'manual' ? null : currentJob.id),
            },
          });
        }

        // Enqueue the tailor task; store the frontend job ID so the poll callback can map back
        const task = await api.enqueueTask({
          workspaceId,
          jobId: dbJobId,
          type: 'tailor',
          agents: {
            tailoringProvider: stateRef.current.tailorProvider !== 'auto' ? stateRef.current.tailorProvider : undefined,
            tailoringModel: stateRef.current.tailorModel !== 'auto' ? stateRef.current.tailorModel : undefined,
            scoringProvider: stateRef.current.scoreProvider !== 'auto' ? stateRef.current.scoreProvider : undefined,
            scoringModel: stateRef.current.scoreModel !== 'auto' ? stateRef.current.scoreModel : undefined,
          },
          promptOverrides: stateRef.current.promptSources as Record<string, string>,
          includeScoring: true,
          input: {
            resume: stateRef.current.sourceResume,
            bio: stateRef.current.sourceBio,
            company: currentJob.company,
            jobTitle: currentJob.title,
            jobDescription: currentJob.jd,
            baseCoverLetter: stateRef.current.sourceCoverLetter,
            resumeSupplemental: stateRef.current.sourceSupplemental,
            _frontendJobId: jobId,
          },
        });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Task ${task.id.slice(0, 8)} is generating resume and cover letter for ${currentJob.company}.`,
          logType: 'working',
        });
        console.info('[workbench] Enqueued tailoring task', {
          taskId: task.id,
          frontendJobId: jobId,
          dbJobId,
        });

        // Remove from queue; tailorRunning stays set until the poll callback clears it
        const latestState = stateRef.current;
        const nextQueue =
          latestState.tailorQueue[0] === jobId
            ? latestState.tailorQueue.slice(1)
            : latestState.tailorQueue.filter((id) => id !== jobId);
        dispatch({ type: 'SET_TAILOR_QUEUE', queue: nextQueue });

        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: `Generating draft for ${currentJob.company}`, type: 'working' },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'UPDATE_JOB', id: jobId, patch: { status: 'error', error: errorMessage } });
        dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
        dispatch({
          type: 'SET_RUN_FEEDBACK',
          feedback: { text: 'Failed to queue tailoring', type: 'error' },
        });
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Failed to queue ${currentJob.company}: ${errorMessage}`,
          logType: 'error',
        });
        console.error('[workbench] Failed to queue tailoring task', {
          frontendJobId: jobId,
          company: currentJob.company,
          error: errorMessage,
        });
      }

      processingRef.current = false;
    }

    void processJob();
  }, [state.tailorQueue, state.tailorRunning, state.jobs, dispatch]);
}
