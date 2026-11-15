import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The current time, to the minute. Updates as each minute starts and when the app comes back
 * to the foreground. (useToday only changes at midnight.)
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const current = new Date();
    const untilNextMinute = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
    // A little late rather than early, so the new minute has surely started.
    const timer = setTimeout(() => setNow(new Date()), untilNextMinute + 50);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [now]);

  return now;
}
