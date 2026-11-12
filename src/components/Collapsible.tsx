import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const DURATION_MS = 260;

/** Open/closed state plus a value that animates 0 (closed) → 1 (open) to follow it. */
export function useExpandable(initiallyExpanded = false) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  // (Not `useAnimatedValue`: react-native-web doesn't export it.)
  const [progress] = useState(() => new Animated.Value(initiallyExpanded ? 1 : 0));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      // Height can't be animated on the native driver.
      useNativeDriver: false,
    }).start();
  };

  return { expanded, toggle, progress };
}

type CollapsibleProps = {
  progress: Animated.Value;
  expanded: boolean;
  children: ReactNode;
  /** Padding etc. for the content; it counts toward the height that's revealed. */
  contentStyle?: StyleProp<ViewStyle>;
};

/** Grows from nothing to its content's full height, fading in, as `progress` goes 0 → 1. */
export function Collapsible({ progress, expanded, children, contentStyle }: CollapsibleProps) {
  const [contentHeight, setContentHeight] = useState(0);

  const onContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  return (
    <Animated.View
      style={[
        styles.clip,
        {
          height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }),
          opacity: progress,
        },
      ]}
      aria-hidden={!expanded}
    >
      {/* Absolutely positioned so it always lays out at full height, even while the clip is 0 tall. */}
      <View style={[styles.content, contentStyle]} onLayout={onContentLayout}>
        {children}
      </View>
    </Animated.View>
  );
}

/** Chevron that turns from pointing down to pointing up as `progress` goes 0 → 1. */
export function ExpandChevron({
  progress,
  size,
  color,
}: {
  progress: Animated.Value;
  size: number;
  color: string;
}) {
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
