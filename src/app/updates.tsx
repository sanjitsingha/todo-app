import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
// Just these icons, not the whole icon set.
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleArrowDown from 'lucide-react-native/icons/circle-arrow-down';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Info from 'lucide-react-native/icons/info';
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetGrabber } from '@/components/SheetGrabber';
import { colors } from '@/constants/theme';
import { formatDueDateTime, toDateKey, toTimeKey } from '@/lib/dates';

const ICON_SIZE = 22;

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

/**
 * What this sheet last found out. A downloaded update waiting for a restart (from the check when
 * the app opened, or from here) comes from useUpdates() instead, and wins over all of these.
 */
type Status =
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'available'; publishedAt?: Date }
  | { kind: 'downloading' }
  | { kind: 'checkFailed' }
  | { kind: 'downloadFailed' };

/** Asks the update server whether there's anything new, as what the sheet should say. */
async function askServer(): Promise<Status> {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      // Updates from EAS Update say when they were published; an embedded one wouldn't.
      const { manifest } = result;
      const publishedAt = 'createdAt' in manifest ? new Date(manifest.createdAt) : undefined;
      return { kind: 'available', publishedAt };
    }
    // A rollback is applied the same way as an update: download, then restart.
    if (result.isRollBackToEmbedded) return { kind: 'available' };
    return { kind: 'upToDate' };
  } catch {
    return { kind: 'checkFailed' };
  }
}

/** "Today, 4:12 pm", or e.g. "Wed, 12 Nov, 4:12 pm". */
function formatMoment(date: Date): string {
  return formatDueDateTime(toDateKey(date), toTimeKey(date.getHours(), date.getMinutes()));
}

/** "Version 1.0.0 · Updated Today, 4:12 pm", or "· As installed" before any update. */
function versionLine(currentlyRunning: Updates.UseUpdatesReturnType['currentlyRunning']): string {
  const version = `Version ${Constants.expoConfig?.version ?? '–'}`;
  if (!Updates.isEnabled) return version;
  if (currentlyRunning.isEmbeddedLaunch || !currentlyRunning.createdAt) {
    return `${version} · As installed`;
  }
  return `${version} · Updated ${formatMoment(currentlyRunning.createdAt)}`;
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** Grey instead of yellow, for the less important "Check again". */
  secondary?: boolean;
  disabled?: boolean;
};

function SheetButton({ label, onPress, secondary = false, disabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && (secondary ? styles.buttonSecondaryPressed : styles.buttonPressed),
        disabled && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Sheet for over-the-air updates (EAS Update), opened from Profile's Check for Updates. It
 * checks as soon as it opens and says what it found: up to date, an update to download (which
 * then restarts the app into it), or one already downloaded that's waiting for a restart. The
 * app also checks by itself each time it opens and downloads in the background, so that last one
 * is common. Updates only come to the installed app: in development and Expo Go, the sheet says
 * so instead.
 */
export default function UpdatesScreen() {
  const insets = useSafeAreaInsets();
  const { currentlyRunning, isUpdatePending, downloadProgress, isRestarting } =
    Updates.useUpdates();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  // Decided once, on opening: an update finishing its download meanwhile shouldn't check again.
  const [checkOnOpen] = useState(() => Updates.isEnabled && !isUpdatePending);

  // Checks on opening (the sheet starts out saying it's checking), unless updates are off here
  // or one is already waiting.
  useEffect(() => {
    if (!checkOnOpen) return;
    let open = true;
    void askServer().then((answer) => {
      if (open) setStatus(answer);
    });
    return () => {
      open = false;
    };
  }, [checkOnOpen]);

  const check = () => {
    setStatus({ kind: 'checking' });
    void askServer().then(setStatus);
  };

  const download = async () => {
    setStatus({ kind: 'downloading' });
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew || result.isRollBackToEmbedded) {
        // Resolves just before the restart, so nothing should come after it.
        await Updates.reloadAsync();
        return;
      }
      // Nothing new after all (say, it was taken back on the server).
      setStatus({ kind: 'upToDate' });
    } catch {
      setStatus({ kind: 'downloadFailed' });
    }
  };

  const restart = () => {
    Updates.reloadAsync().catch(() => setStatus({ kind: 'downloadFailed' }));
  };

  // What to show, worked out in one place so the layout below stays the same for every state.
  // No icon means busy: a spinner shows in its place.
  let icon: LucideIcon | null = null;
  let tint: string = colors.ink;
  let tintBackground: string = colors.inputBackground;
  let title: string;
  let body: string;
  let button: ButtonProps | null = null;

  if (!Updates.isEnabled) {
    icon = Info;
    tint = colors.textMuted;
    title = 'Updates are off here';
    body =
      'Updates come to the installed app. While developing, it runs the latest code from your computer.';
  } else if (isUpdatePending || isRestarting) {
    icon = isRestarting ? null : CircleArrowDown;
    tint = colors.skyDark;
    tintBackground = colors.skySoft;
    title = 'Update ready';
    body = 'It’s downloaded. Restart Dooist to start using it.';
    button = { label: isRestarting ? 'Restarting…' : 'Restart now', onPress: restart, disabled: isRestarting };
  } else {
    switch (status.kind) {
      case 'checking':
        title = 'Checking for updates…';
        body = 'This only takes a moment.';
        button = { label: 'Checking…', disabled: true };
        break;
      case 'available':
        icon = CircleArrowDown;
        tint = colors.skyDark;
        tintBackground = colors.skySoft;
        title = 'Update available';
        body = status.publishedAt
          ? `A new version came out ${formatMoment(status.publishedAt)}. Dooist restarts once it’s downloaded.`
          : 'A new version is out. Dooist restarts once it’s downloaded.';
        button = { label: 'Update now', onPress: () => void download() };
        break;
      case 'downloading': {
        tint = colors.skyDark;
        tintBackground = colors.skySoft;
        const percent =
          downloadProgress !== undefined ? ` ${Math.round(downloadProgress * 100)}%` : '';
        title = 'Downloading update…';
        body = 'Keep Dooist open. It restarts by itself when it’s done.';
        button = { label: `Downloading…${percent}`, disabled: true };
        break;
      }
      case 'upToDate':
        icon = CircleCheck;
        tint = colors.success;
        title = 'You’re up to date';
        body = 'You have the latest version of Dooist.';
        button = { label: 'Check again', onPress: check, secondary: true };
        break;
      case 'checkFailed':
        icon = CircleAlert;
        tint = colors.danger;
        tintBackground = colors.dangerSoft;
        title = 'Couldn’t check for updates';
        body = 'Check your internet connection and try again.';
        button = { label: 'Try again', onPress: check };
        break;
      case 'downloadFailed':
        icon = CircleAlert;
        tint = colors.danger;
        tintBackground = colors.dangerSoft;
        title = 'Couldn’t download the update';
        body = 'Check your internet connection and try again.';
        button = { label: 'Try again', onPress: () => void download() };
        break;
    }
  }

  const Icon = icon;
  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 24;

  return (
    <View style={[styles.screen, { paddingBottom: bottomPadding }]}>
      <SheetGrabber />
      <Text style={styles.heading} accessibilityRole="header">
        Updates
      </Text>

      <View style={styles.status} accessibilityLiveRegion="polite">
        <View style={[styles.badge, { backgroundColor: tintBackground }]}>
          {Icon ? (
            <Icon size={ICON_SIZE} color={tint} />
          ) : (
            <ActivityIndicator color={tint} />
          )}
        </View>
        <View style={styles.statusText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>

      {button ? <SheetButton {...button} /> : null}

      <Text style={styles.version}>{versionLine(currentlyRunning)}</Text>
    </View>
  );
}

const BADGE_SIZE = 44;

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
    paddingHorizontal: 20,
  },
  // As on the app's other sheets.
  heading: {
    marginBottom: 16,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // Same as the reminder and due-date sheets' main button.
  button: {
    marginTop: 20,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonSecondary: {
    backgroundColor: colors.inputBackground,
  },
  buttonSecondaryPressed: {
    backgroundColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  version: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textSubtle,
  },
});
