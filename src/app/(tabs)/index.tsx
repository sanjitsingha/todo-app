// Just these icons, not the whole icon set.
import GalleryVertical from 'lucide-react-native/icons/gallery-vertical';
import Rows3 from 'lucide-react-native/icons/rows-3';
import { startTransition, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { DateHeader } from '@/components/DateHeader';
import { DateStrip } from '@/components/DateStrip';
import { DayPager } from '@/components/DayPager';
import { DayTodos, useDayTodos } from '@/components/DayTodos';
import { GoalRing } from '@/components/GoalRing';
import { FEATURES } from '@/constants/features';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { DateKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { updateSettings, useSettings } from '@/store/settings';

/**
 * The view button's icons, drawn to the same size. Lucide's rows-3 is a square 20 of its 24
 * units tall; gallery-vertical's top and bottom lines reach 22, so at the same size it comes
 * out taller and the icon seems to grow when the view changes. It's drawn smaller to fit the
 * same square, with its stroke thickened to match, so its lines are just as thick.
 */
const VIEW_ICON_SIZE = 20;
const ROWS_ICON_UNITS = 20;
const GALLERY_ICON_UNITS = 22;
const LUCIDE_STROKE = 2;
const GALLERY_ICON_SIZE = VIEW_ICON_SIZE * (ROWS_ICON_UNITS / GALLERY_ICON_UNITS);
const GALLERY_STROKE = LUCIDE_STROKE * (VIEW_ICON_SIZE / GALLERY_ICON_SIZE);

export default function TodoScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { today, selectedDate, selectDate } = useSelectedDate();
  // List or timeline; remembered between launches.
  const { todoView } = useSettings();
  const showTimeline = todoView === 'timeline';

  // For the goal ring: every todo due on the picked day.
  const { pendingTodos, completedTodos } = useDayTodos(selectedDate);

  // Where a swipe of the day pager has got to, for the date strip to move along with it.
  const swipePosition = useSharedValue<number | null>(null);

  // Switching views draws a whole new list or timeline for each day the pager has ready,
  // which takes a moment, so it's done in steps that never hold up the screen: the button
  // changes at once; then the day on screen switches, drawn in the background (React pauses it
  // for anything urgent); then, once that's on screen, the days beside it follow.
  const pageShowsTimeline = useDeferredValue(showTimeline);
  const [besideShowsTimeline, setBesideShowsTimeline] = useState(showTimeline);
  useEffect(() => {
    startTransition(() => setBesideShowsTimeline(pageShowsTimeline));
  }, [pageShowsTimeline]);

  // One page per day, swiped through sideways (src/components/DayPager.tsx).
  const renderDay = useCallback(
    (date: DateKey) => (
      <DayTodos
        date={date}
        today={today}
        showTimeline={date === selectedDate ? pageShowsTimeline : besideShowsTimeline}
      />
    ),
    [today, selectedDate, pageShowsTimeline, besideShowsTimeline],
  );

  const timelineButton = (
    <Pressable
      onPress={() => updateSettings({ todoView: showTimeline ? 'list' : 'timeline' })}
      hitSlop={6}
      style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
      accessibilityRole="switch"
      accessibilityLabel="Timeline view"
      accessibilityState={{ checked: showTimeline }}
    >
      {/* Shows the view you're in: rows for the list, the timeline icon for the timeline. */}
      {showTimeline ? (
        <GalleryVertical
          size={GALLERY_ICON_SIZE}
          strokeWidth={GALLERY_STROKE}
          color={colors.ink}
        />
      ) : (
        <Rows3 size={VIEW_ICON_SIZE} color={colors.ink} />
      )}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <DateHeader
        date={selectedDate}
        // Hidden for now (FEATURES.goalRingInHeader); it's moving somewhere else later.
        accessory={
          FEATURES.goalRingInHeader ? (
            <GoalRing
              total={pendingTodos.length + completedTodos.length}
              done={completedTodos.length}
            />
          ) : undefined
        }
        action={timelineButton}
      />
      <DateStrip
        today={today}
        selectedDate={selectedDate}
        onSelectDate={selectDate}
        follow={swipePosition}
      />

      {/* Everything below the date strip sits on the list color (white in the light look).
          The day's todos swipe sideways to the next or previous day. */}
      <View style={styles.section}>
        <DayPager
          today={today}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          renderDay={renderDay}
          swipePosition={swipePosition}
        />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // The header's color, from the top of the screen (behind the status bar) down to the date
  // strip.
  screen: {
    flex: 1,
    backgroundColor: colors.headerBackground,
  },
  section: {
    flex: 1,
    backgroundColor: colors.listBackground,
  },
  // Round icon button; its icon shows which view is on.
  viewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonPressed: {
    backgroundColor: colors.border,
  },
}));
