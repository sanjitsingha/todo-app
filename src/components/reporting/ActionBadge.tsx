import { View, type StyleProp, type ViewStyle } from 'react-native';

import { reportTypeInfo } from '@/constants/reportTypes';
import { useColors } from '@/hooks/useTheme';
import type { ReportType } from '@/lib/activity';

const RING_WIDTH = 2;

/**
 * A small colored circle with the action's icon (src/constants/reportTypes.ts). `ring` adds a
 * border of that color around it, to set it apart from what it sits on.
 */
export function ActionBadge({
  type,
  size = 16,
  ring,
  style,
}: {
  type: ReportType;
  size?: number;
  ring?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const { icon: Icon, color, onColor } = reportTypeInfo(type);
  const outer = ring ? size + RING_WIDTH * 2 : size;
  return (
    <View
      style={[
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors[color],
        },
        ring ? { borderWidth: RING_WIDTH, borderColor: ring } : null,
        style,
      ]}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.6)} color={colors[onColor]} strokeWidth={3.5} />
    </View>
  );
}
