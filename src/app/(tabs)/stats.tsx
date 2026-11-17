import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChipGroup, type ChipOption } from '@/components/ChipGroup';
import { TodosWrittenChart, type ChartRange } from '@/components/TodosWrittenChart';
import { colors } from '@/constants/theme';

const RANGE_OPTIONS: readonly ChipOption<ChartRange>[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * The Stats tab: charts of how your todos are going, each on a white card on the gray page.
 * For now, todos written per hour or day. The Today / Week / Month chips just under the header
 * pick the range; they stay put while the cards scroll.
 */
export default function StatsScreen() {
  const [range, setRange] = useState<ChartRange>('week');

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        <ChipGroup
          value={range}
          options={RANGE_OPTIONS}
          onChange={setRange}
          accessibilityLabel="Time range"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            Todos written
          </Text>
          <TodosWrittenChart range={range} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  chips: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  title: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
});
