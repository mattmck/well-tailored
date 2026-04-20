type Source = 'editor' | 'preview';
type Listener = (heading: string, source: Source) => void;

const listeners = new Set<Listener>();

export const sectionSync = {
  emit(heading: string, source: Source) {
    listeners.forEach((l) => l(heading, source));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
