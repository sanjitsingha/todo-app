import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThemedStyles } from '@/hooks/useTheme';
import { formatDueDateTime, toDateKey, toTimeKey } from '@/lib/dates';

/**
 * A version's name and what's new in it, from `expo.extra.release` in app.json. Every update
 * and build carries the app config it was made with, so an update's notes can be read before
 * it's downloaded. Before each update or build, set the new `version` (1.1.1, 1.1.2…) and
 * `notes` there. It's separate from `expo.version`, which picks the installs an update can go
 * to (app.json's runtimeVersion follows it), so that one changes only with a new build.
 */
type Release = { version?: string; notes: string[] };

/** The release info in an app config (or an update's copy of one). */
function releaseIn(config: unknown): Release {
  const app = (config ?? {}) as { version?: unknown; extra?: { release?: unknown } };
  const release = (app.extra?.release ?? {}) as { version?: unknown; notes?: unknown };
  const version =
    typeof release.version === 'string'
      ? release.version
      : typeof app.version === 'string'
        ? app.version
        : undefined;
  const notes = Array.isArray(release.notes)
    ? release.notes.filter((note): note is string => typeof note === 'string' && note.trim() !== '')
    : [];
  return { version, notes };
}

/** An update's release info, from the app config inside its manifest. */
function releaseOfManifest(manifest: unknown): Release {
  const extra = (manifest as { extra?: { expoClient?: unknown } } | undefined)?.extra;
  return releaseIn(extra?.expoClient);
}

/** An update, as this page talks about it. */
type Found = { release: Release; publishedAt?: Date };

/**
 * What this page last found out. A downloaded update waiting for a restart (from the check when
 * the app opened, or from here) comes from useUpdates() instead, and wins over all of these.
 */
type Status =
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'checkFailed' }
  | ({ kind: 'available' } & Found)
  | ({ kind: 'downloading' } & Found)
  | ({ kind: 'downloadFailed' } & Found);

/** Asks the update server whether there's anything new, as what the page should say. */
async function askServer(): Promise<Status> {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      const { manifest } = result;
      // Updates from EAS Update say when they were published.
      const publishedAt = 'createdAt' in manifest ? new Date(manifest.createdAt) : undefined;
      return { kind: 'available', release: releaseOfManifest(manifest), publishedAt };
    }
    // A rollback is applied the same way as an update: download, then restart.
    if (result.isRollBackToEmbedded) {
      return { kind: 'available', release: releaseIn(Constants.expoConfig) };
    }
    return { kind: 'upToDate' };
  } catch {
    return { kind: 'checkFailed' };
  }
}

/** "Today, 4:12 pm", or e.g. "Wed, 12 Nov, 4:12 pm". */
function formatMoment(date: Date): string {
  return formatDueDateTime(toDateKey(date), toTimeKey(date.getHours(), date.getMinutes()));
}

/** "Version 1.1.2 · Released Today, 4:12 pm". */
function foundLine({ release, publishedAt }: Found): string {
  const version = release.version ? `Version ${release.version}` : 'A new version';
  return publishedAt ? `${version} · Released ${formatMoment(publishedAt)}` : version;
}

/** "Version 1.1.1 · Updated Today, 4:12 pm", or "· As installed" before any update. */
function currentLine(
  release: Release,
  currentlyRunning: Updates.UseUpdatesReturnType['currentlyRunning'],
): string {
  const version = `Version ${release.version ?? '–'}`;
  if (!Updates.isEnabled) return version;
  if (currentlyRunning.isEmbeddedLaunch || !currentlyRunning.createdAt) {
    return `${version} · As installed`;
  }
  return `${version} · Updated ${formatMoment(currentlyRunning.createdAt)}`;
}

type ButtonProps = { label: string; onPress?: () => void; disabled?: boolean };

/** The page's one button, at the bottom. */
function BottomButton({ label, onPress, disabled = false }: ButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
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
 * The Updates page for over-the-air updates (EAS Update), opened from Profile's Check for
 * Updates. It checks as soon as it opens. With an update out, it shows that version's name,
 * when it came out and what's new, and the button at the bottom updates (downloads it and
 * restarts into it). Otherwise it shows the version running now and what's in it, with Check
 * for updates at the bottom. The app also checks by itself each time it opens and downloads in
 * the background, so an update is often already downloaded and only needs the restart.
 * Updates only come to the installed app: in development and Expo Go, the page says so.
 */
export default function UpdatesScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { currentlyRunning, isUpdatePending, downloadedUpdate, downloadProgress, isRestarting } =
    Updates.useUpdates();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  // Decided once, on opening: an update finishing its download meanwhile shouldn't check again.
  const [checkOnOpen] = useState(() => Updates.isEnabled && !isUpdatePending);
  const current = releaseIn(Constants.expoConfig);

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

  const download = async (found: Found) => {
    setStatus({ kind: 'downloading', ...found });
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
      setStatus({ kind: 'downloadFailed', ...found });
    }
  };

  const restart = () => {
    Updates.reloadAsync().catch(() => setStatus({ kind: 'checkFailed' }));
  };

  // What to show, worked out in one place so the layout below is the same for every state:
  // a title, a line under it, what's new (in the update, or in the version running now), and
  // the button.
  let title: string;
  let subtitle: string;
  let notesTitle = 'In this version';
  let notes = current.notes;
  let note: string | null = null;
  let button: ButtonProps;

  if (!Updates.isEnabled) {
    title = 'Updates come to the installed app';
    subtitle = 'While developing, Dooist runs the latest code from your computer.';
    button = { label: 'Check for updates', disabled: true };
  } else if (isUpdatePending || isRestarting) {
    const found: Found = {
      release: releaseOfManifest(downloadedUpdate?.manifest),
      publishedAt: downloadedUpdate?.createdAt,
    };
    title = 'Update ready';
    subtitle = foundLine(found);
    notesTitle = 'What’s new';
    notes = found.release.notes;
    note = 'It’s downloaded. Dooist restarts to start using it.';
    button = isRestarting
      ? { label: 'Restarting…', disabled: true }
      : { label: 'Update', onPress: restart };
  } else {
    switch (status.kind) {
      case 'checking':
        title = 'Checking for updates…';
        subtitle = currentLine(current, currentlyRunning);
        button = { label: 'Checking…', disabled: true };
        break;
      case 'upToDate':
        title = 'You’re up to date';
        subtitle = currentLine(current, currentlyRunning);
        button = { label: 'Check for updates', onPress: check };
        break;
      case 'checkFailed':
        title = 'Couldn’t check for updates';
        subtitle = 'Check your internet connection and try again.';
        button = { label: 'Check for updates', onPress: check };
        break;
      case 'available':
        title = 'Update available';
        subtitle = foundLine(status);
        notesTitle = 'What’s new';
        notes = status.release.notes;
        note = 'Dooist restarts by itself once the update is downloaded.';
        button = { label: 'Update', onPress: () => void download(status) };
        break;
      case 'downloading': {
        title = 'Downloading update…';
        subtitle = foundLine(status);
        notesTitle = 'What’s new';
        notes = status.release.notes;
        note = 'Keep Dooist open. It restarts by itself when it’s done.';
        const percent =
          downloadProgress !== undefined ? ` ${Math.round(downloadProgress * 100)}%` : '';
        button = { label: `Downloading…${percent}`, disabled: true };
        break;
      }
      case 'downloadFailed':
        title = 'Couldn’t download the update';
        subtitle = 'Check your internet connection and try again.';
        notesTitle = 'What’s new';
        notes = status.release.notes;
        button = { label: 'Update', onPress: () => void download(status) };
        break;
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View accessibilityLiveRegion="polite">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {notes.length > 0 ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>{notesTitle}</Text>
            {notes.map((line, index) => (
              <View key={index} style={styles.noteRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.noteText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <BottomButton {...button} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  notes: {
    gap: 10,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  noteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.primary,
  },
  noteText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // The button keeps to the bottom, with a line between it and what scrolls above.
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.page,
  },
  // Same as the app's other main buttons.
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
}));
