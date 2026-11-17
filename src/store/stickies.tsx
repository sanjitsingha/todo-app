import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

/** A sticky note on the Sticky tab's wall. */
export type Sticky = {
  id: string;
  text: string;
  color: StickyColor;
  /** Its top-left corner, in points from the top-left of the wall. */
  x: number;
  y: number;
  /** How far it leans, in degrees (clockwise), so the wall looks stuck up by hand. */
  rotation: number;
  createdAt: number;
};

export type NewSticky = Pick<Sticky, 'text' | 'color' | 'x' | 'y' | 'rotation'>;

type StickiesContextValue = {
  /** Bottom to top: later ones are stuck over earlier ones. */
  stickies: Sticky[];
  addSticky: (sticky: NewSticky) => void;
  /** Rewrites a sticky's text or color. */
  editSticky: (id: string, changes: Partial<Pick<Sticky, 'text' | 'color'>>) => void;
  /** Moves a sticky to (x, y) and puts it on top of the others, as when it's dragged there. */
  moveSticky: (id: string, x: number, y: number) => void;
  removeSticky: (id: string) => void;
};

const STORAGE_KEY = 'stickies';
const COLORS: readonly StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

const StickiesContext = createContext<StickiesContextValue | null>(null);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function loadStickies(): Sticky[] {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (sticky: Sticky) =>
          typeof sticky?.id === 'string' && isFiniteNumber(sticky.x) && isFiniteNumber(sticky.y),
      )
      .map((sticky: Sticky) => ({
        id: sticky.id,
        text: typeof sticky.text === 'string' ? sticky.text : '',
        color: COLORS.includes(sticky.color) ? sticky.color : 'yellow',
        x: sticky.x,
        y: sticky.y,
        rotation: isFiniteNumber(sticky.rotation) ? sticky.rotation : 0,
        createdAt: isFiniteNumber(sticky.createdAt) ? sticky.createdAt : Date.now(),
      }));
  } catch (error) {
    console.warn('Could not load saved stickies', error);
    return [];
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Holds the stickies on the wall and saves them on the device. */
export function StickiesProvider({ children }: { children: ReactNode }) {
  const [stickies, setStickies] = useState<Sticky[]>(loadStickies);

  useEffect(() => {
    try {
      Storage.setItemSync(STORAGE_KEY, JSON.stringify(stickies));
    } catch (error) {
      console.warn('Could not save stickies', error);
    }
  }, [stickies]);

  const addSticky = useCallback((sticky: NewSticky) => {
    setStickies((current) => [...current, { ...sticky, id: createId(), createdAt: Date.now() }]);
  }, []);

  const editSticky = useCallback(
    (id: string, changes: Partial<Pick<Sticky, 'text' | 'color'>>) => {
      setStickies((current) =>
        current.map((sticky) => (sticky.id === id ? { ...sticky, ...changes } : sticky)),
      );
    },
    [],
  );

  const moveSticky = useCallback((id: string, x: number, y: number) => {
    setStickies((current) => {
      const sticky = current.find((item) => item.id === id);
      if (!sticky) return current;
      return [...current.filter((item) => item.id !== id), { ...sticky, x, y }];
    });
  }, []);

  const removeSticky = useCallback((id: string) => {
    setStickies((current) => current.filter((sticky) => sticky.id !== id));
  }, []);

  const value = useMemo(
    () => ({ stickies, addSticky, editSticky, moveSticky, removeSticky }),
    [stickies, addSticky, editSticky, moveSticky, removeSticky],
  );

  return <StickiesContext value={value}>{children}</StickiesContext>;
}

export function useStickies(): StickiesContextValue {
  const context = use(StickiesContext);
  if (!context) {
    throw new Error('useStickies must be used inside <StickiesProvider>');
  }
  return context;
}
