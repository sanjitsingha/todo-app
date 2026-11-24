import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { reportTypeInfo } from '@/constants/reportTypes';
import { lightColors as colors } from '@/constants/theme';
import { groupByDay, type ActivityEvent, type DateChoice } from '@/lib/activity';
import { formatActivityDay, fromDateKey, type DateKey } from '@/lib/dates';

/**
 * The Reporting log as a PDF, laid out like the tab: written as a web page, which expo-print
 * turns into a PDF, then handed to the share sheet to save or send. Like the web app's. Always
 * in the light look, whatever the app's, since a PDF is mostly printed or sent on.
 */

export type ReportPdf = {
  /** Every row the filters let through. */
  events: readonly ActivityEvent[];
  today: DateKey;
  title: string;
  /** Muted lines under the title, such as the filters. */
  details: readonly string[];
  /** The letter in the avatar circles. */
  initial: string;
  fileName: string;
};

/** A4, in the points expo-print measures pages in. */
const PAGE = { width: 595, height: 842 };
/** Room around the page: iOS takes it as an option, Android from the page's CSS. */
const MARGIN = { top: 36, right: 36, bottom: 44, left: 36 };

/** The same Lucide icons as the tab (ISC license), as SVG on a 24 by 24 grid. */
const CIRCLE = '<circle cx="12" cy="12" r="10"/>';
const ICONS = {
  added: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  updated:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  completed: '<path d="M20 6 9 17l-5-5"/>',
  deleted:
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  todo: CIRCLE,
  doneTodo: `${CIRCLE}<path d="m16 9-5.5 5.5L8 12"/>`,
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text as it has to be written inside the page, so a todo named "<b>" stays just that. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

function svg(paths: string, color: string, strokeWidth: number): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function rowHtml(event: ActivityEvent, initial: string): string {
  const action = reportTypeInfo(event.kind);
  const done = event.kind === 'completed';
  const todoIcon = done
    ? svg(ICONS.doneTodo, colors.primary, 2)
    : svg(ICONS.todo, colors.textMuted, 2);
  const badge = svg(ICONS[event.kind], colors[action.onColor], 3.5);
  return `<li>
  <span class="avatar">${escapeHtml(initial)}<span class="badge" style="background:${colors[action.color]}">${badge}</span></span>
  <span class="who">You ${event.kind}</span>
  <span class="chip${event.kind === 'deleted' ? ' deleted' : ''}">${todoIcon}<span class="title">${escapeHtml(event.title)}</span></span>
</li>`;
}

/** The whole report as a web page. */
export function reportHtml({ events, today, title, details, initial }: ReportPdf): string {
  const now = fromDateKey(today);
  const days = groupByDay(events)
    .map(
      ({ day, items }) => `<section>
<h2>${escapeHtml(formatActivityDay(day, now))}<span>${items.length}</span></h2>
<ul>${items.map((event) => rowHtml(event, initial)).join('')}</ul>
</section>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page {
    size: A4;
    margin: ${MARGIN.top}pt ${MARGIN.right}pt ${MARGIN.bottom}pt ${MARGIN.left}pt;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font: 10px sans-serif;
      color: ${colors.textMuted};
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", "Noto Sans", sans-serif;
    font-size: 14px;
    color: ${colors.text};
  }
  header { margin-bottom: 24px; }
  h1 { margin: 0 0 6px; font-size: 24px; font-weight: 700; }
  header p { margin: 0 0 2px; font-size: 12px; color: ${colors.textMuted}; }
  section { margin-bottom: 20px; }
  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 0 2px 8px;
    border-bottom: 1px solid ${colors.border};
    font-size: 14px;
    font-weight: 700;
    break-after: avoid;
    page-break-after: avoid;
  }
  h2 span { font-weight: 400; color: ${colors.textMuted}; }
  ul { margin: 0; padding: 2px 0; list-style: none; border-bottom: 1px solid ${colors.border}; }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    padding: 7px 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .avatar {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    /* The web app's avatar colors, so the orange Completed badge stands out on it. */
    background: ${colors.accentSoft};
    color: ${colors.accentDark};
    font-size: 13px;
    font-weight: 600;
  }
  .badge {
    position: absolute;
    right: -4px;
    bottom: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
  }
  .badge svg { width: 8px; height: 8px; }
  .who { flex: none; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid ${colors.border};
    border-radius: 8px;
  }
  .chip svg { flex: none; width: 14px; height: 14px; }
  .title { overflow-wrap: anywhere; }
  .deleted .title { color: ${colors.textMuted}; text-decoration: line-through; }
</style>
</head>
<body>
<header>
<h1>${escapeHtml(title)}</h1>
${details.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
</header>
${days}
</body>
</html>`;
}

/** e.g. "dooist-activity-2026-11-24.pdf", named after the dates it covers, as on the web. */
export function reportFileName(date: DateChoice, today: DateKey): string {
  const dates =
    date === 'any'
      ? `all-${today}`
      : date === 'today'
        ? today
        : date === 'week'
          ? `week-${today}`
          : date === 'month'
            ? today.slice(0, 7)
            : date;
  return `dooist-activity-${dates}.pdf`;
}

/**
 * The native parts that make and share the PDF (expo-print, expo-sharing, expo-file-system).
 * Builds from before 1.2.0 don't have the first two, and over-the-air updates still reach them,
 * so those libraries are only loaded once these are known to be there: loading one on a build
 * without it would crash the app.
 */
const PDF_NATIVE_MODULES = ['ExpoPrint', 'ExpoSharing', 'FileSystem'];

/** True when this build of the app can make PDFs (1.2.0 and later). */
export function canExportPdf(): boolean {
  return PDF_NATIVE_MODULES.every((name) => requireOptionalNativeModule(name) !== null);
}

/**
 * Makes the PDF and opens the share sheet for it, to save it to the phone or send it. Throws
 * if it couldn't be made or the phone can't share files, so check canExportPdf first. Resolves
 * once the sheet is closed, whether or not it was shared.
 */
export async function shareReportPdf(report: ReportPdf): Promise<void> {
  if (!canExportPdf()) throw new Error('This build of the app can’t make PDFs');
  // Loaded here, not at the top of the file, so builds without them never load them (above).
  /* eslint-disable @typescript-eslint/no-require-imports */
  const Print: typeof import('expo-print') = require('expo-print');
  const Sharing: typeof import('expo-sharing') = require('expo-sharing');
  const { File, Paths }: typeof import('expo-file-system') = require('expo-file-system');
  /* eslint-enable @typescript-eslint/no-require-imports */

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');

  const { uri } = await Print.printToFileAsync({
    html: reportHtml(report),
    width: PAGE.width,
    height: PAGE.height,
    ...(Platform.OS === 'ios' ? { margins: MARGIN } : {}),
  });

  // expo-print gives it a random name; this is the one people see when saving or sending it.
  let shared = uri;
  try {
    const named = new File(Paths.cache, report.fileName);
    await new File(uri).move(named, { overwrite: true });
    shared = named.uri;
  } catch (error) {
    console.warn('Could not name the report PDF; sharing it as it is.', error);
  }

  await Sharing.shareAsync(shared, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share the report',
  });
}
