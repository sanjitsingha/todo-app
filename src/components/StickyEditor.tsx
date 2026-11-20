import { useIsFocused } from 'expo-router';
// Just these icons, not the whole icon set.
import Trash2 from 'lucide-react-native/icons/trash-2';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { stickyShadow } from '@/components/StickyNote';
import {
  STICKY_COLORS,
  STICKY_FONT_SIZE,
  STICKY_LINE_HEIGHT,
  STICKY_MAX_LENGTH,
  STICKY_PADDING,
  STICKY_RADIUS,
  STICKY_SIZE,
  stickyFill,
} from '@/constants/sticky';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { Placement, WallSize } from '@/lib/stickyLayout';
import type { StickyColor } from '@/store/stickies';

/** Largest the sticky gets in the editor; smaller on small screens, clear of the keyboard. */
const EDITOR_MAX_SIZE = 240;
/** From the top of the wall: the Remove and Done buttons, then the sticky below them. */
const TOOLBAR_TOP = 12;
const TOOLBAR_HEIGHT = 40;
const STICKY_TOP = TOOLBAR_TOP + TOOLBAR_HEIGHT + 20;
/** Between the sticky and the colors under it. */
const SWATCH_GAP = 20;
const SWATCH_SIZE = 28;

/** Out of the wall to the editor, and back: smooth, with a slight bounce as it lands. */
const OPEN_SPRING = { duration: 480, dampingRatio: 0.82 };
const CLOSE_SPRING = { duration: 440, dampingRatio: 0.8 };
/** A new sticky pops up in place. */
const POP_SPRING = { duration: 380, dampingRatio: 0.72 };
const CHROME_FADE = { duration: 220 };
/** Taken down: it drops, tips over and fades, like peeling a note off and letting it fall. */
const PEEL = { duration: 300, easing: Easing.in(Easing.cubic) };
const COLOR_FADE = { duration: 200 };

export type EditorResult = { text: string; color: StickyColor; placement: Placement };

type Props = {
  /** The text and color it opens with. */
  initialText: string;
  initialColor: StickyColor;
  /** Where the sticky is on the wall, or null for a new one. */
  from: Placement | null;
  wall: WallSize;
  /** Where a new sticky goes once it's done. */
  placeNew: () => Placement;
  /** Done and back on the wall, at `placement`: save it. */
  onDone: (result: EditorResult) => void;
  /** Taken down (or done with nothing written), and gone from view. */
  onRemove: () => void;
};

/**
 * Writing on a sticky. An existing sticky grows out of its place on the wall, straightening as
 * it comes, to the top of the screen, bigger, with the keyboard up; a new one pops up there.
 * The wall fades back behind it. Colors to pick sit under it; Remove and Done above it.
 *
 * Done (or a tap on the wall, or Back on Android) shrinks it back onto the wall: to its place,
 * or for a new one, to the first free spot, leaning a little, as if pressed on. With nothing
 * written, it's taken down instead: it drops, tips over and fades, as does Remove. Leaving the
 * tab saves it as it is.
 *
 * The sticky is drawn at full size with everything scaled up alike (STICKY_SIZE's layout, times
 * the editor's size over it) and scaled down by a transform on the way back, so its text wraps
 * the same on the wall as here and it lands without a jump.
 */
export function StickyEditor({
  initialText,
  initialColor,
  from,
  wall,
  placeNew,
  onDone,
  onRemove,
}: Props) {
  const styles = useStyles();
  const colors = useColors();
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  // Shown by the buttons; the ref stops a second tap from closing it twice before that.
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { height: windowHeight } = useWindowDimensions();
  const size = Math.round(
    Math.max(STICKY_SIZE, Math.min(EDITOR_MAX_SIZE, wall.width - 64, windowHeight * 0.3)),
  );
  const scale = size / STICKY_SIZE;
  const left = (wall.width - size) / 2;

  // 0: on the wall at `place`, as small as there; 1: here in the editor.
  const progress = useSharedValue(from ? 0 : 1);
  const place = useSharedValue<Placement>(from ?? { x: 0, y: 0, rotation: 0 });
  // A new sticky pops up: 0 → 1.
  const appear = useSharedValue(from ? 1 : 0);
  // 0 → 1 as it's taken down.
  const peel = useSharedValue(0);
  // The veil over the wall and the buttons around the sticky: 0 → 1.
  const chrome = useSharedValue(0);

  useEffect(() => {
    if (from) progress.set(withSpring(1, OPEN_SPRING));
    else appear.set(withSpring(1, POP_SPRING));
    chrome.set(withTiming(1, CHROME_FADE));
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** False if it's already closing. */
  const startClosing = () => {
    if (closingRef.current) return false;
    closingRef.current = true;
    setClosing(true);
    inputRef.current?.blur();
    Keyboard.dismiss();
    chrome.set(withTiming(0, CHROME_FADE));
    return true;
  };

  const remove = () => {
    if (!startClosing()) return;
    peel.set(
      withTiming(1, PEEL, () => {
        scheduleOnRN(onRemove);
      }),
    );
  };

  const finish = () => {
    const written = text.trim();
    if (!written) {
      remove();
      return;
    }
    if (!startClosing()) return;
    const placement = from ?? placeNew();
    place.set(placement);
    progress.set(
      withSpring(0, CLOSE_SPRING, () => {
        scheduleOnRN(onDone, { text: written, color, placement });
      }),
    );
  };

  // Back on Android finishes, as Done does.
  const latest = useRef({ finish, text, color });
  useLayoutEffect(() => {
    latest.current = { finish, text, color };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current.finish();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // Leaving the tab saves it as it is, at once, so the keyboard doesn't follow to the next tab.
  const focused = useIsFocused();
  useEffect(() => {
    if (focused || closingRef.current) return;
    closingRef.current = true;
    const now = latest.current;
    inputRef.current?.blur();
    const written = now.text.trim();
    if (!written) onRemove();
    else onDone({ text: written, color: now.color, placement: from ?? placeNew() });
  }, [focused, from, placeNew, onDone, onRemove]);

  const stickyStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const target = place.get();
    const a = appear.get();
    const gone = peel.get();
    // From the editor's middle to the middle of its place on the wall.
    const dx = target.x + STICKY_SIZE / 2 - (left + size / 2);
    const dy = target.y + STICKY_SIZE / 2 - (STICKY_TOP + size / 2);
    const shrunk = STICKY_SIZE / size;
    return {
      opacity: Math.min(1, a) * (1 - gone),
      transform: [
        { translateX: dx * (1 - p) },
        { translateY: dy * (1 - p) + 90 * gone },
        { rotate: `${target.rotation * (1 - p) + 14 * gone}deg` },
        { scale: (shrunk + (1 - shrunk) * p) * (0.9 + 0.1 * a) * (1 - 0.15 * gone) },
      ],
    };
  });
  // The paper's color eases from one to the next.
  const fill = stickyFill(color);
  const paperStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(fill, COLOR_FADE),
  }));
  // Held up off the wall, it casts a deeper shadow, which goes as it lands.
  const liftedShadow = useAnimatedStyle(() => ({ opacity: progress.get() * (1 - peel.get()) }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.get() }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.veil, chromeStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={finish}
          accessibilityLabel="Done"
          accessibilityHint="Puts the sticky on the wall"
        />
      </Animated.View>

      <Animated.View
        style={[styles.toolbar, chromeStyle]}
        pointerEvents={closing ? 'none' : 'box-none'}
      >
        <Pressable
          onPress={remove}
          hitSlop={8}
          style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={from ? 'Remove sticky' : 'Discard sticky'}
        >
          <Trash2 size={20} color={colors.danger} />
        </Pressable>
        <Pressable
          onPress={finish}
          hitSlop={8}
          style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.sticky, { left, top: STICKY_TOP, width: size, height: size }, stickyStyle]}
      >
        <Animated.View
          style={[
            styles.liftedShadow,
            { backgroundColor: fill, borderRadius: STICKY_RADIUS * scale },
            liftedShadow,
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.paper,
            { borderRadius: STICKY_RADIUS * scale, boxShadow: stickyShadow(scale) },
            paperStyle,
          ]}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            editable={!closing}
            multiline
            autoFocus
            maxLength={STICKY_MAX_LENGTH}
            placeholder="Write something…"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.stickyInk}
            cursorColor={colors.stickyInk}
            style={[
              styles.input,
              {
                padding: STICKY_PADDING * scale,
                fontSize: STICKY_FONT_SIZE * scale,
                lineHeight: STICKY_LINE_HEIGHT * scale,
              },
            ]}
            accessibilityLabel="Sticky text"
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.swatches, { top: STICKY_TOP + size + SWATCH_GAP }, chromeStyle]}
        pointerEvents={closing ? 'none' : 'box-none'}
        accessibilityRole="radiogroup"
        accessibilityLabel="Sticky color"
      >
        {STICKY_COLORS.map((option) => {
          const selected = option.value === color;
          return (
            <Pressable
              key={option.value}
              onPress={() => setColor(option.value)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: option.fill },
                  selected && styles.swatchSelected,
                ]}
              />
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.wallVeil,
  },
  toolbar: {
    position: 'absolute',
    top: TOOLBAR_TOP,
    left: 16,
    right: 16,
    height: TOOLBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeButton: {
    width: TOOLBAR_HEIGHT,
    height: TOOLBAR_HEIGHT,
    borderRadius: TOOLBAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
  },
  removeButtonPressed: {
    backgroundColor: colors.dangerSoft,
  },
  doneButton: {
    height: TOOLBAR_HEIGHT,
    paddingHorizontal: 20,
    borderRadius: TOOLBAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  doneButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  sticky: {
    position: 'absolute',
  },
  // Same size and color as the paper, right behind it: only its shadow shows.
  liftedShadow: {
    ...StyleSheet.absoluteFill,
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.22)',
  },
  paper: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontWeight: '500',
    color: colors.stickyInk,
    textAlignVertical: 'top',
  },
  swatches: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.15)',
  },
  // A dark ring around the picked color, with a little space between.
  swatchSelected: {
    outlineWidth: 2,
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineColor: colors.ink,
  },
}));
