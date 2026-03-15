import { useState, useCallback, useRef } from 'react';
import { SectionList, View, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, ActivityIndicator, Chip, SegmentedButtons, Portal, Dialog, Paragraph, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('Overview');

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100;

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
  const [tanDialog, setTanDialog] = useState<{ visible: boolean; challenge: string }>({ visible: false, challenge: '' });
  const pollingRef = useRef(false);

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

  const pollBalanceTan = useCallback(async (referenceId: string) => {
    pollingRef.current = true;
    let polls = 0;

    while (pollingRef.current && polls < MAX_POLLS) {
      polls++;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      if (!pollingRef.current) break;

      try {
        log.info(`Polling TAN for balance refresh (attempt ${polls})`);
        const res = await apiFetch('/api/accounts/fints/poll', {
          method: 'POST',
          body: JSON.stringify({ referenceId }),
        });
        const data = await res.json();

        if (data.status === 'success') {
          log.info('Balance refresh complete after TAN');
          pollingRef.current = false;
          setTanDialog({ visible: false, challenge: '' });
          return;
        }

        if (data.status !== 'pending') {
          log.error('Unexpected poll response during balance refresh', data);
          pollingRef.current = false;
          setTanDialog({ visible: false, challenge: '' });
          return;
        }
      } catch (err) {
        log.error('Poll failed during balance refresh', err);
        pollingRef.current = false;
        setTanDialog({ visible: false, challenge: '' });
        return;
      }
    }

    if (polls >= MAX_POLLS) {
      log.warn('TAN polling timed out during balance refresh');
      pollingRef.current = false;
      setTanDialog({ visible: false, challenge: '' });
    }
  }, []);

  const cancelTanPolling = useCallback(() => {
    pollingRef.current = false;
    setTanDialog({ visible: false, challenge: '' });
    log.info('User cancelled TAN approval for balance refresh');
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    log.info('Refreshing balances');
    try {
      const res = await apiFetch('/api/accounts/balances/refresh', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.status === 'tan_required') {
        log.info('TAN required for balance refresh', { referenceId: data.referenceId });
        setTanDialog({ visible: true, challenge: data.tanChallenge || 'Please approve in your banking app' });
        await pollBalanceTan(data.referenceId);
      }

      await fetchSummary(filter);
    } catch (err) {
      log.error('Failed to refresh balances', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchSummary, filter, pollBalanceTan]);

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
                title={item.ownerName || item.externalId}
                subtitle={`${item.name}    ${item.amount.toFixed(2)} ${item.currency ?? ''}`}
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

      <Portal>
        <Dialog visible={tanDialog.visible} dismissable={false}>
          <Dialog.Title>Approve in Banking App</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{tanDialog.challenge}</Paragraph>
            <ActivityIndicator style={{ marginVertical: 16 }} />
            <Paragraph style={{ textAlign: 'center', opacity: 0.6 }}>Waiting for approval...</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={cancelTanPolling}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
