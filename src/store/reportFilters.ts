import { useSyncExternalStore } from 'react';

import type { DateChoice, ReportType } from '@/lib/activity';

export type ReportFilters = {
  /** Which actions to show. None ticked means all of them. */
  types: readonly ReportType[];
  /** Starts on today, like the web app. */
  date: DateChoice;
};

// A plain module store, so the filter sheets (src/app/report-actions.tsx, report-date.tsx) can
// change what the Reporting tab shows. Kept until the app closes.
let filters: ReportFilters = { types: [], date: 'today' };
const listeners = new Set<() => void>();

export function setReportFilters(changes: Partial<ReportFilters>) {
  filters = { ...filters, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getFilters = () => filters;

/** The Reporting tab's filters. Re-renders when they change. */
export function useReportFilters(): ReportFilters {
  return useSyncExternalStore(subscribe, getFilters);
}
