import { useRouter } from 'expo-router';
// Just these icons, not the whole icon set.
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { deleteAccount, useAuth } from '@/store/auth';

type RowProps = {
  label: string;
  /** An icon before the label. */
  icon?: ReactNode;
  /** A line under the label, saying more about it. */
  description?: string;
  /** What sits at the right: a value, the avatar, a spinner. */
  children?: ReactNode;
  /** Tappable rows get a chevron; the rest (Avatar, Email) only show. */
  onPress?: () => void;
  /** Red, for Delete account. */
  destructive?: boolean;
};

/** A row of the Account page: its label on the left, and its value (and a chevron) on the right. */
function Row({ label, icon, description, children, onPress, destructive = false }: RowProps) {
  const styles = useStyles();
  const colors = useColors();
  const title = <Text style={[styles.label, destructive && styles.labelDestructive]}>{label}</Text>;
  const content = (
    <>
      {icon}
      {description ? (
        // The label and its line take the room; whatever's at the right keeps to its size.
        <View style={styles.labelBlock}>
          {title}
          <Text style={styles.description}>{description}</Text>
        </View>
      ) : (
        title
      )}
      <View style={description ? null : styles.value}>{children}</View>
      {onPress ? <ChevronRight size={18} color={colors.iconInactive} /> : null}
    </>
  );
  const accessibilityLabel = description ? `${label}. ${description}` : label;

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        // Android shows a ripple instead.
        pressed && Platform.OS !== 'android' && styles.rowPressed,
      ]}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  );
}

/**
 * The Account page, opened from Profile: Avatar (the Google account's picture, not changeable
 * yet), Name (changed in a sheet, src/app/account-name.tsx), Email (only shown), Password (set
 * or changed on its own page, src/app/account-password.tsx), and Delete account.
 */
export default function AccountScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  // No one's signed in only for a moment, while deleting the account (or logging out elsewhere)
  // moves to the login screen.
  if (!user) return <View style={styles.page} />;

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This deletes your account and all your todos, settings and Google Calendar connection, for good. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const problem = await deleteAccount(user.id);
            // Deleted: signed out, and the app moves to Log in by itself.
            if (problem) {
              setDeleting(false);
              Alert.alert('Couldn’t delete your account', problem);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <Row label="Avatar">
        <Avatar uri={user.avatarUrl} name={user.name} email={user.email} />
      </Row>
      <Row label="Name" onPress={() => router.push('/account-name')}>
        <Text style={styles.valueText} numberOfLines={1}>
          {user.name ?? 'Add your name'}
        </Text>
      </Row>
      <Row label="Email">
        <Text style={styles.valueText} numberOfLines={1}>
          {user.email}
        </Text>
      </Row>
      {/* No value: whether a Google account has a password can't be told from here. */}
      <Row label="Password" onPress={() => router.push('/account-password')} />

      {/* Sets Delete account apart from the rest. */}
      <View style={styles.divider} />
      <Row
        label="Delete account"
        icon={<TriangleAlert size={22} color={colors.primary} />}
        description="Deleting your account is permanent. You’ll immediately lose access to all your data."
        destructive
        onPress={deleting ? undefined : confirmDelete}
      >
        {deleting ? <ActivityIndicator color={colors.danger} /> : null}
      </Row>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingVertical: 8,
  },
  // Like Profile's rows.
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  label: {
    fontSize: 16,
    color: colors.text,
  },
  labelDestructive: {
    color: colors.danger,
  },
  // Takes the room between the label and the chevron, with the value at its right end.
  value: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: 16,
    backgroundColor: colors.divider,
  },
}));
