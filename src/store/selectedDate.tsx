import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { useToday } from '@/hooks/useToday';
import { toDateKey, type DateKey } from '@/lib/dates';

type SelectedDateContextValue = {
  /** The real current date. */
  today: Date;
  todayKey: DateKey;
  /** The day picked in the date strip. Today by default. */
  selectedDate: DateKey;
  selectDate: (date: DateKey) => void;
};

const SelectedDateContext = createContext<SelectedDateContextValue | null>(null);

/**
 * The day picked in the date strip, shared by the Todo screen and the Add todo sheet.
 * It remembers which day it was picked on, so when the date changes (midnight, or opening
 * the app the next day) it goes back to today. Going to another tab puts it back on today too
 * (src/app/(tabs)/_layout.tsx).
 */
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const todayKey = toDateKey(today);

  const [selection, setSelection] = useState({ date: todayKey, pickedOn: todayKey });
  const selectedDate = selection.pickedOn === todayKey ? selection.date : todayKey;

  const selectDate = useCallback(
    (date: DateKey) =>
      setSelection((previous) =>
        previous.date === date && previous.pickedOn === todayKey
          ? previous
          : { date, pickedOn: todayKey },
      ),
    [todayKey],
  );

  const value = useMemo(
    () => ({ today, todayKey, selectedDate, selectDate }),
    [today, todayKey, selectedDate, selectDate],
  );

  return <SelectedDateContext value={value}>{children}</SelectedDateContext>;
}

export function useSelectedDate(): SelectedDateContextValue {
  const context = use(SelectedDateContext);
  if (!context) {
    throw new Error('useSelectedDate must be used inside <SelectedDateProvider>');
  }
  return context;
}
