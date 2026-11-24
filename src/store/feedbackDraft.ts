import { useSyncExternalStore } from 'react';

import type { FeedbackSubject } from '@/lib/database.types';

// A plain module store, so the Subject sheet (src/app/feedback-subject.tsx) can hand its pick to
// the Feedback page (src/app/feedback.tsx). The page clears it each time it opens and closes.
let subject: FeedbackSubject | null = null;
const listeners = new Set<() => void>();

export function setFeedbackSubject(next: FeedbackSubject | null) {
  subject = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSubject = () => subject;

/** The subject picked for the feedback being written, or null. Re-renders when it changes. */
export function useFeedbackSubject(): FeedbackSubject | null {
  return useSyncExternalStore(subscribe, getSubject);
}
