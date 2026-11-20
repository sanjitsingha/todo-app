import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { createThemedStyles } from '@/hooks/useTheme';

type Props = {
  /** The picture (the Google account's, for Google sign-ins). */
  uri?: string;
  /** For the initial when there's no picture: the name, or else the email. */
  name?: string;
  email: string;
  /** Diameter, in points. */
  size?: number;
};

/**
 * Someone's picture in a circle. Without one (an email sign-up), or if it doesn't load, the
 * first letter of their name (or email) on the Dooist orange.
 */
export function Avatar({ uri, name, email, size = 44 }: Props) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, circle]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }

  const initial = (name || email).trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.fallback, circle]} accessible={false}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Behind the picture while it loads.
  image: {
    backgroundColor: colors.inputBackground,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  initial: {
    fontWeight: '700',
    color: colors.onPrimary,
  },
}));
