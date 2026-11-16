import { ScrollView, StyleSheet, Text } from 'react-native';

import { TodosWrittenChart } from '@/components/TodosWrittenChart';
import { colors } from '@/constants/theme';

/** The Stats tab: charts of how your todos are going. For now, todos written per day. */
export default function StatsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Todos written
      </Text>
      <TodosWrittenChart />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
});
