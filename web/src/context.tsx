import { createContext, useContext, Dispatch } from 'react';
import { WorkspaceState } from './types';
import { Action } from './state';

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<Action>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>(null!);

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
