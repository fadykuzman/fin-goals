import { useState, useCallback } from 'react';
import { SectionList, View, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, ActivityIndicator, Chip, SegmentedButtons } from 'react-native-paper';
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

interface MemberSummary {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  subtotal: number;
  accounts: AccountSummary[];
}

interface BalanceSummary {
  total: number;
  members: MemberSummary[];
}

type FilterValue = 'all' | 'personal' | 'family';

export default function OverviewScreen() {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [hasFamily, setHasFamily] = useState(false);

  const fetchSummary = useCallback(async (filterValue: FilterValue) => {
    try {
      const query = filterValue !== 'all' ? `?filter=${filterValue}` : '';
      const res = await apiFetch(`/api/balances/summary${query}`);
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
        if (filterValue === 'all') {
          setHasFamily(data.members.length > 1 || data.members.some((m: MemberSummary) => !m.isCurrentUser));
        }
      } else {
        setSummary({ total: 0, members: [] });
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
      fetchSummary(filter);
    }, [fetchSummary, filter])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/accounts/balances/refresh', {
        method: 'POST',
      });
      await fetchSummary(filter);
    } catch (err) {
      log.error('Failed to refresh balances', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchSummary, filter]);

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterValue);
    setLoading(true);
    fetchSummary(value as FilterValue);
  };

  const currency = summary?.members
    ?.flatMap((m) => m.accounts)
    .find((a) => a.currency)?.currency ?? '';

  const sections = (summary?.members ?? []).map((member) => ({
    title: member.displayName,
    subtotal: member.subtotal,
    isCurrentUser: member.isCurrentUser,
    data: member.accounts,
  }));

  return (
    <View style={styles.container}>
      {hasFamily && (
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
      )}

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginVertical: 32 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.accountId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <Text variant="displaySmall" style={styles.totalAmount}>
                {(summary?.total ?? 0).toFixed(2)} {currency}
              </Text>
              <Text variant="bodyMedium" style={styles.totalLabel}>
                Total Balance
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No accounts found. Link a bank in Settings.</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="titleSmall" style={styles.sectionName}>
                {section.title}{section.isCurrentUser ? ' (You)' : ''}
              </Text>
              <Text variant="bodySmall" style={styles.sectionSubtotal}>
                {section.subtotal.toFixed(2)} {currency}
              </Text>
            </View>
          )}
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
      )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sectionName: {
    fontWeight: 'bold',
  },
  sectionSubtotal: {
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
