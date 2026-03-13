import { useState, useCallback } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('Overview');

interface AccountSummary {
  accountId: string;
  externalId: string;
  name: string | null;
  ownerName: string | null;
  includedInTotal: boolean;
  amount: number;
  currency: string | null;
}

interface BalanceSummary {
  total: number;
  accounts: AccountSummary[];
}

export default function OverviewScreen() {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/balances/summary');
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
      } else {
        setSummary({ total: 0, accounts: [] });
      }
    } catch (err) {
      log.error('Failed to fetch balance summary', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSummary();
    }, [fetchSummary])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/accounts/balances/refresh', {
        method: 'POST',
      });
      await fetchSummary();
    } catch (err) {
      log.error('Failed to refresh balances', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchSummary]);

  const currency = summary?.accounts?.find((a) => a.currency)?.currency ?? '';

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginVertical: 32 }} />
      ) : (
        <>
          <Text variant="displaySmall" style={styles.totalAmount}>
            {(summary?.total ?? 0).toFixed(2)} {currency}
          </Text>
          <Text variant="bodyMedium" style={styles.totalLabel}>
            Total Balance
          </Text>

          <FlatList
            data={summary?.accounts ?? []}
            keyExtractor={(item) => item.accountId}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <Text style={styles.empty}>No accounts found. Link a bank in Settings.</Text>
            }
            renderItem={({ item }) => (
              <Card style={[styles.card, !item.includedInTotal && styles.cardExcluded]}>
                <Card.Title
                  title={item.name || item.ownerName || item.externalId}
                  subtitle={`${item.amount.toFixed(2)} ${item.currency ?? ''}`}
                  right={() =>
                    !item.includedInTotal ? (
                      <Chip style={styles.excludedChip} textStyle={styles.excludedChipText}>
                        Excluded
                      </Chip>
                    ) : null
                  }
                />
              </Card>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  totalAmount: {
    textAlign: 'center',
    marginTop: 24,
    fontWeight: 'bold',
  },
  totalLabel: {
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 24,
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
  cardExcluded: {
    opacity: 0.5,
  },
  excludedChip: {
    marginRight: 8,
  },
  excludedChipText: {
    fontSize: 12,
  },
});
