import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  ProgressBar,
  Card,
  Button,
  Chip,
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

interface MatchedTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  accountName: string | null;
}

interface GoalDetail {
  id: string;
  name: string;
  goalType: string;
  targetAmount: number;
  initialAmount: number;
  matchPattern: string | null;
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
  matchedTransactions?: MatchedTransaction[];
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
            <Text style={styles.dimText}>Type</Text>
            <Text>{goal.goalType === 'transaction_based' ? 'Transaction-based' : 'Balance-based'}</Text>
          </View>
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
          {goal.matchPattern && (
            <>
              <Text style={[styles.dimText, { marginTop: 8, marginBottom: 4 }]}>Match Patterns</Text>
              <View style={styles.chipContainer}>
                {goal.matchPattern.split(',').map((p, i) => (
                  <Chip key={i} compact>{p.trim()}</Chip>
                ))}
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Matched transactions section */}
      {goal.matchedTransactions && (
        <Card style={styles.card}>
          <List.Accordion
            title={`Matched Transactions (${goal.matchedTransactions.length})`}
            titleStyle={styles.accordionTitle}
            style={styles.accordion}
          >
            {goal.matchedTransactions.length === 0 ? (
              <Text style={[styles.dimText, { paddingHorizontal: 16, paddingBottom: 12 }]}>No matching transactions found.</Text>
            ) : (
              (() => {
                const grouped = goal.matchedTransactions.reduce<Record<string, MatchedTransaction[]>>((acc, tx) => {
                  const key = tx.accountName || 'Unknown Account';
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(tx);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([accountName, txs]) => (
                  <List.Accordion
                    key={accountName}
                    title={`${accountName} (${txs.length})`}
                    titleStyle={styles.subAccordionTitle}
                    style={styles.subAccordion}
                  >
                    {txs.map((tx, index) => (
                      <View key={tx.id} style={styles.txItemContainer}>
                        {index > 0 && <Divider />}
                        <View style={styles.txRow}>
                          <Text variant="bodyMedium" style={styles.txDate}>
                            {new Date(tx.date).toLocaleDateString()}
                          </Text>
                          <Text variant="bodyMedium" style={styles.txDescription} numberOfLines={1}>
                            {tx.description}
                          </Text>
                          <Text variant="bodyMedium" style={styles.txAmount}>
                            {formatAmount(Math.abs(tx.amount), tx.currency)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </List.Accordion>
                ));
              })()
            )}
          </List.Accordion>
        </Card>
      )}

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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accordion: {
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  accordionTitle: {
    fontWeight: '600',
  },
  subAccordion: {
    paddingLeft: 8,
    backgroundColor: 'transparent',
  },
  subAccordionTitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  txItemContainer: {
    paddingHorizontal: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  txDate: {
    width: 90,
    opacity: 0.6,
  },
  txDescription: {
    flex: 1,
    marginHorizontal: 8,
  },
  txAmount: {
    fontWeight: '600',
    textAlign: 'right',
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
