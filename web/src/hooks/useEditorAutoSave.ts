import { useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import { editorDataMatchesDoc } from '../lib/job-documents';
import { reconstructEditorData } from '../lib/markdown';
import type { EditorData, Job } from '../types';
import * as api from '../api/client';

interface PendingSave {
  frontendJobId: string;
  dbJobId: string | null;
  workspaceId: string | null;
  docType: 'resume' | 'cover';
  editorData: EditorData;
  fingerprint: string;
  job: Pick<Job, 'company' | 'title' | 'jd' | 'stage' | 'source' | 'huntrId' | 'listAddedAt'>;
}

/**
 * Auto-saves editor data to the DB when the user edits in the structured editor.
 * Debounces writes so rapid edits don't flood the server.
 */
export function useEditorAutoSave(debounceMs = 1500) {
  const { state, dispatch } = useWorkspace();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<Map<string, string>>(new Map());
  const pendingRef = useRef<PendingSave | null>(null);

  const flushPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingRef.current;
    if (!pending) return;

    pendingRef.current = null;
    const lastSavedKey = `${pending.frontendJobId}:${pending.docType}`;
    if (lastSavedRef.current.get(lastSavedKey) === pending.fingerprint) return;

    const markdown = reconstructEditorData(pending.editorData);
    const editorDataJson = JSON.stringify(pending.editorData);

    const resolveSaveJobId = async (): Promise<string | undefined> => {
      if (pending.dbJobId) return pending.dbJobId;
      // Local-only sessions do not have DB records yet, so return undefined to skip auto-save.
      if (!pending.workspaceId) return undefined;

      const dbJob = await api.createJob(pending.workspaceId, {
        company: pending.job.company,
        title: pending.job.title || undefined,
        jd: pending.job.jd || undefined,
        stage: pending.job.stage || undefined,
        source: pending.job.source ?? 'huntr',
        huntrId: pending.job.huntrId ?? (pending.job.source === 'manual' ? undefined : pending.frontendJobId),
        listAddedAt: pending.job.listAddedAt ?? null,
      });
      dispatch({
        type: 'UPDATE_JOB',
        id: pending.frontendJobId,
        patch: {
          dbJobId: dbJob.id,
          huntrId: dbJob.huntrId ?? pending.job.huntrId ?? null,
        },
      });
      return dbJob.id;
    };

    resolveSaveJobId()
      .then((saveJobId) => {
        if (!saveJobId) return false;
        return api.saveDocument(saveJobId, pending.docType, markdown, editorDataJson).then(() => true);
      })
      .then((saved) => {
        if (!saved) return;
        lastSavedRef.current.set(lastSavedKey, pending.fingerprint);
        console.info('[workbench] Auto-saved editor data', {
          jobId: pending.frontendJobId,
          docType: pending.docType,
        });
      })
      .catch((err) => {
        console.warn('[workbench] Auto-save failed', {
          jobId: pending.frontendJobId,
          docType: pending.docType,
          error: err,
        });
      });
  }, [dispatch]);

  useEffect(() => {
    const activeDoc = state.activeDoc;
    const docType = activeDoc === 'resume' ? 'resume' as const : 'cover' as const;

    if (
      pendingRef.current &&
      (pendingRef.current.frontendJobId !== state.activeJobId || pendingRef.current.docType !== docType)
    ) {
      flushPendingSave();
    }

    const job = state.activeJobId
      ? state.jobs.find((j) => j.id === state.activeJobId)
      : null;

    if (!job?.result || !editorDataMatchesDoc(job._editorData, activeDoc)) return;

    const editorData = job._editorData;
    const jobId = job.id;

    // Auto-save requires a persisted DB target, either via workspace context or an existing DB job id.
    if (!state.activeWorkspaceId && !job.dbJobId) return;

    // Build a fingerprint to detect actual changes
    const editorDataJson = JSON.stringify(editorData);
    const fingerprint = `${jobId}:${docType}:${editorDataJson}`;
    const lastSavedKey = `${jobId}:${docType}`;
    if (fingerprint === lastSavedRef.current.get(lastSavedKey)) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    pendingRef.current = {
      frontendJobId: jobId,
      dbJobId: job.dbJobId ?? null,
      workspaceId: state.activeWorkspaceId,
      docType,
      editorData,
      fingerprint,
      job: {
        company: job.company,
        title: job.title,
        jd: job.jd,
        stage: job.stage,
        source: job.source,
        huntrId: job.huntrId ?? null,
        listAddedAt: job.listAddedAt ?? null,
      },
    };
    timerRef.current = setTimeout(flushPendingSave, debounceMs);
  }, [state.activeJobId, state.activeDoc, state.jobs, debounceMs, flushPendingSave]);

  useEffect(() => {
    return () => flushPendingSave();
  }, [flushPendingSave]);
}
