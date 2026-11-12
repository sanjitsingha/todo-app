import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toDateKey } from '@/lib/dates';

/** Today's date. Updates at midnight and when the app comes back to the foreground. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      // Keep the same object if the day hasn't changed, to avoid needless re-renders.
      setToday((previous) => (toDateKey(previous) === toDateKey(now) ? previous : now));
    };

    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 1000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
