import { Text, View } from 'react-native';

import { createThemedStyles } from '@/hooks/useTheme';
import { addDays, formatTime, fromDateKey, toTimeKey, type DateKey } from '@/lib/dates';
import type { CalendarEvent } from '@/store/calendarEvents';

/** "9:00 am", from an ISO time, in the phone's time zone. */
function clock(iso: string): string {
  const date = new Date(iso);
  return formatTime(toTimeKey(date.getHours(), date.getMinutes()));
}

/**
 * When `event` is, as seen on `date`: "All day", "9:00 am – 10:00 am", or for one that runs
 * over from another day, "Until 10:00 am" / "From 11:00 pm" / "All day".
 */
function whenLabel(event: CalendarEvent, date: DateKey): string {
  if (event.allDay) return 'All day';
  const dayStart = fromDateKey(date).getTime();
  const dayEnd = addDays(fromDateKey(date), 1).getTime();
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const startsToday = start >= dayStart;
  const endsToday = end <= dayEnd;
  if (startsToday && endsToday) {
    return end > start ? `${clock(event.start)} – ${clock(event.end)}` : clock(event.start);
  }
  if (startsToday) return `From ${clock(event.start)}`;
  if (endsToday) return `Until ${clock(event.end)}`;
  return 'All day';
}

type Props = {
  events: readonly CalendarEvent[];
  date: DateKey;
};

/**
 * The day's Google Calendar events, above its todos (when Events is on, on the Calendar page):
 * each one's time and title, plain and read-only.
 */
export function DayEvents({ events, date }: Props) {
  const styles = useStyles();
  if (events.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Events
      </Text>
      {events.map((event) => {
        const when = whenLabel(event, date);
        return (
          <View
            key={event.id}
            style={styles.event}
            accessible
            accessibilityLabel={`${event.title}, ${when}`}
          >
            <Text style={styles.when} numberOfLines={1}>
              {when}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Lined up with the todo cards' 16px edges, with a card's gap below.
  section: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    gap: 8,
  },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  when: {
    width: 128,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
}));
