import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The app icon's foreground: the "dooist" script mark on a clear background. */
const MARK_SOURCE = require('../../../assets/android-icon-foreground.png');

// Where the mark sits in that 1024 × 1024 picture: the rest is clear, for Android's icon masks.
const PICTURE_SIZE = 1024;
const MARK = { left: 235, top: 424, width: 556, height: 177 };

/** How wide the mark shows. */
const MARK_WIDTH = 180;
const SCALE = MARK_WIDTH / MARK.width;
const MARK_HEIGHT = MARK.height * SCALE;

/** The least room kept between the mark and the status bar above it. */
const GAP = 8;

/**
 * The Dooist mark, centered in the orange top part of the split Log in and Create account
 * screens (src/components/auth/AuthScreen.tsx), like the app icon. It fills that part without
 * taking up room in it, so the form below never moves for it; when the form leaves too little
 * room (a short phone, or the keyboard up) it isn't shown, rather than run into the status bar.
 * Taps go through it, to the back arrow on Create account. Centered, it's clear of that arrow
 * at the left.
 */
export function AuthLogo() {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  // Centered in `height`, its top must clear the status bar.
  const fits = height > 0 && (height - MARK_HEIGHT) / 2 >= insets.top + GAP;

  return (
    <View
      style={styles.fill}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      pointerEvents="none"
    >
      {fits ? (
        // Just the mark: the picture is cropped to it.
        <View style={styles.crop} accessible accessibilityRole="image" accessibilityLabel="Dooist">
          <Image source={MARK_SOURCE} style={styles.picture} accessible={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // All of the top part, from the very top of the screen to the panel.
  fill: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crop: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    overflow: 'hidden',
  },
  picture: {
    position: 'absolute',
    left: -MARK.left * SCALE,
    top: -MARK.top * SCALE,
    width: PICTURE_SIZE * SCALE,
    height: PICTURE_SIZE * SCALE,
  },
});
