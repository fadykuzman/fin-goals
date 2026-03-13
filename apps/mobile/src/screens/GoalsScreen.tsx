import { useState, useCallback } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, ProgressBar, ActivityIndicator, FAB, SegmentedButtons } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('Goals');

interface GoalSummary {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  percentComplete: number;
  requiredPerInterval: number | null;
  isCompleted: boolean;
  isOverdue: boolean;
  currency: string;
  deadline: string;
  interval: string;
  visibility: string;
  accountCount: number;
  owner: { id: string; displayName: string };
  isOwner: boolean;
}

type FilterValue = 'all' | 'personal' | 'family';

export default function GoalsScreen({ navigation }: { navigation: any }) {
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');

  const fetchGoals = useCallback(async (filterValue: FilterValue) => {
    try {
      const query = filterValue !== 'all' ? `?filter=${filterValue}` : '';
      const res = await apiFetch(`/api/goals${query}`);
      const data = await res.json();
      setGoals(data.goals ?? []);
    } catch (err) {
      log.error('Failed to fetch goals', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGoals(filter);
    }, [fetchGoals, filter])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGoals(filter);
    setRefreshing(false);
  }, [fetchGoals, filter]);

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterValue);
    setLoading(true);
    fetchGoals(value as FilterValue);
  };

  const formatAmount = (amount: number, currency: string) =>
    `${amount.toFixed(2)} ${currency}`;

  const formatInterval = (interval: string) =>
    interval === 'monthly' ? '/month' : '/week';

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={filter}
        onValueChange={handleFilterChange}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'personal', label: 'Personal' },
          { value: 'family', label: 'Family' },
        ]}
        style={styles.filterButtons}
      />

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginVertical: 32 }} />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No goals yet. Tap + to create one.</Text>
          }
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => navigation.navigate('GoalDetail', { goalId: item.id })}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{item.name}</Text>
                    {!item.isOwner && (
                      <Text variant="bodySmall" style={styles.ownerText}>
                        by {item.owner.displayName}
                      </Text>
                    )}
                  </View>
                  {item.visibility === 'family' && (
                    <Text style={styles.familyBadge}>Family</Text>
                  )}
                  {item.isCompleted && (
                    <Text style={styles.completedBadge}>Completed</Text>
                  )}
                  {item.isOverdue && !item.isCompleted && (
                    <Text style={styles.overdueBadge}>Overdue</Text>
                  )}
                </View>

                <ProgressBar
                  progress={item.percentComplete / 100}
                  style={styles.progressBar}
                />

                <View style={styles.amountRow}>
                  <Text variant="bodyMedium">
                    {formatAmount(item.currentAmount, item.currency)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.targetText}>
                    {formatAmount(item.targetAmount, item.currency)}
                  </Text>
                </View>

                {item.requiredPerInterval !== null && (
                  <Text variant="bodySmall" style={styles.requiredText}>
                    {formatAmount(item.requiredPerInterval, item.currency)}{formatInterval(item.interval)} needed
                  </Text>
                )}

                <Text variant="bodySmall" style={styles.deadlineText}>
                  Deadline: {new Date(item.deadline).toLocaleDateString()}
                  {item.accountCount > 0 ? ` · ${item.accountCount} linked account${item.accountCount > 1 ? 's' : ''}` : ''}
                </Text>
              </Card.Content>
            </Card>
          )}
        />
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateEditGoal')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  filterButtons: {
    marginBottom: 12,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.6,
  },
  card: {
    marginVertical: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ownerText: {
    opacity: 0.6,
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  targetText: {
    opacity: 0.6,
  },
  requiredText: {
    marginTop: 4,
    opacity: 0.7,
  },
  deadlineText: {
    marginTop: 4,
    opacity: 0.5,
  },
  familyBadge: {
    color: '#1976D2',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 8,
  },
  completedBadge: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 8,
  },
  overdueBadge: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
