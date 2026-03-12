import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  ProgressBar,
  Card,
  Button,
  Dialog,
  Portal,
  ActivityIndicator,
  List,
  Divider,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE = 'https://fedora.foxhound-shark.ts.net';

interface LinkedAccount {
  accountId: string;
  name: string;
  accountType: string;
  amount: number;
  currency: string | null;
}

interface GoalDetail {
  id: string;
  name: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  remaining: number;
  percentComplete: number;
  requiredPerInterval: number | null;
  isCompleted: boolean;
  isOverdue: boolean;
  currency: string;
  deadline: string;
  interval: string;
  accounts: LinkedAccount[];
}

export default function GoalDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const goalId: string = route.params.goalId;

  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchGoal = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/goals/${goalId}`);
      const data = await res.json();
      setGoal(data.goal);
    } catch (err) {
      console.error('Failed to fetch goal:', err);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGoal();
    }, [fetchGoal])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGoal();
    setRefreshing(false);
  }, [fetchGoal]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/goals/${goalId}`, { method: 'DELETE' });
      navigation.goBack();
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setDeleting(false);
      setDeleteDialogVisible(false);
    }
  };

  const formatAmount = (amount: number, currency: string) =>
    `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  const formatInterval = (interval: string) =>
    interval === 'monthly' ? 'month' : 'week';

  if (loading && !refreshing) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  if (!goal) {
    return <Text style={{ textAlign: 'center', marginTop: 32 }}>Goal not found.</Text>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Progress section */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text variant="headlineSmall" style={{ flex: 1 }}>{goal.name}</Text>
            {goal.isCompleted && <Text style={styles.completedBadge}>Completed</Text>}
            {goal.isOverdue && !goal.isCompleted && <Text style={styles.overdueBadge}>Overdue</Text>}
          </View>

          <ProgressBar
            progress={Math.min(goal.percentComplete / 100, 1)}
            style={styles.progressBar}
          />

          <View style={styles.amountRow}>
            <Text variant="titleMedium">{formatAmount(goal.currentAmount, goal.currency)}</Text>
            <Text variant="titleMedium" style={styles.dimText}>
              {formatAmount(goal.targetAmount, goal.currency)}
            </Text>
          </View>

          <Text variant="bodyMedium" style={styles.percentText}>
            {goal.percentComplete.toFixed(1)}% complete
          </Text>

          {goal.remaining > 0 && (
            <Text variant="bodyMedium" style={styles.remainingText}>
              {formatAmount(goal.remaining, goal.currency)} remaining
            </Text>
          )}

          {goal.requiredPerInterval !== null && goal.remaining > 0 && (
            <Text variant="titleSmall" style={styles.requiredText}>
              Save {formatAmount(goal.requiredPerInterval, goal.currency)} / {formatInterval(goal.interval)}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Details section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.dimText}>Deadline</Text>
            <Text>{new Date(goal.deadline).toLocaleDateString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.dimText}>Interval</Text>
            <Text>{goal.interval === 'monthly' ? 'Monthly' : 'Weekly'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.dimText}>Initial Amount</Text>
            <Text>{formatAmount(goal.initialAmount, goal.currency)}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Linked accounts section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Linked Accounts</Text>
          {goal.accounts.length === 0 ? (
            <Text style={styles.dimText}>No accounts linked to this goal.</Text>
          ) : (
            goal.accounts.map((account, index) => (
              <View key={account.accountId}>
                {index > 0 && <Divider />}
                <List.Item
                  title={account.name}
                  description={account.accountType === 'investment' ? 'Investment' : 'Cash'}
                  right={() => (
                    <Text style={styles.accountAmount}>
                      {formatAmount(account.amount, account.currency ?? goal.currency)}
                    </Text>
                  )}
                  style={styles.accountItem}
                />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="pencil"
          onPress={() => navigation.navigate('CreateEditGoal', { goalId: goal.id })}
          style={styles.editButton}
        >
          Edit Goal
        </Button>
        <Button
          mode="outlined"
          icon="delete"
          textColor="#F44336"
          onPress={() => setDeleteDialogVisible(true)}
          style={styles.deleteButton}
        >
          Delete Goal
        </Button>
      </View>

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Goal</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete "{goal.name}"? This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} disabled={deleting}>Cancel</Button>
            <Button onPress={handleDelete} loading={deleting} disabled={deleting} textColor="#F44336">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dimText: {
    opacity: 0.6,
  },
  percentText: {
    marginTop: 4,
    opacity: 0.7,
  },
  remainingText: {
    marginTop: 2,
    opacity: 0.7,
  },
  requiredText: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  accountItem: {
    paddingHorizontal: 0,
  },
  accountAmount: {
    alignSelf: 'center',
    fontWeight: '600',
  },
  actions: {
    marginTop: 4,
    marginBottom: 32,
    gap: 8,
  },
  editButton: {
    // default styling
  },
  deleteButton: {
    borderColor: '#F44336',
  },
  completedBadge: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 13,
  },
  overdueBadge: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
