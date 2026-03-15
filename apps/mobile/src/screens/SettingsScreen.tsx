import { useState, useCallback, useRef } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { Button, Card, Text, IconButton, ActivityIndicator, Divider, Dialog, Portal, Paragraph, List } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('Settings');

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100;

interface Account {
  id: string;
  externalId: string;
  name: string | null;
  ownerName: string | null;
  lastSyncedAt: string | null;
  accountType: string | null;
}

interface BankConnection {
  id: string;
  provider: string;
  institutionId: string;
  status: string;
  createdAt: string;
  accounts: Account[];
}

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return 'Never synced';
  const date = new Date(dateStr);
  return `Synced ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());
  const [tanDialog, setTanDialog] = useState<{ visible: boolean; challenge: string }>({ visible: false, challenge: '' });
  const pollingRef = useRef(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await apiFetch('/api/bank-connections');
      const data = await res.json();
      setConnections(data.connections);
      log.info('Bank Connections', data.connections)
    } catch (err) {
      log.error('Failed to fetch connections', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConnections();
    }, [fetchConnections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  }, [fetchConnections]);

  const pollFinTSTan = async (referenceId: string, accountId: string) => {
    pollingRef.current = true;
    let polls = 0;

    while (pollingRef.current && polls < MAX_POLLS) {
      polls++;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      if (!pollingRef.current) break;

      try {
        log.info(`Polling TAN for transaction sync (attempt ${polls})`, { accountId });
        const res = await apiFetch('/api/accounts/fints/poll', {
          method: 'POST',
          body: JSON.stringify({ referenceId }),
        });
        const data = await res.json();

        if (data.status === 'success') {
          log.info('Transaction sync complete after TAN', { accountId });
          pollingRef.current = false;
          setTanDialog({ visible: false, challenge: '' });
          await fetchConnections();
          return;
        }

        if (data.status !== 'pending') {
          log.error('Unexpected poll response during sync', data);
          pollingRef.current = false;
          setTanDialog({ visible: false, challenge: '' });
          return;
        }
      } catch (err) {
        log.error('Poll failed during transaction sync', err);
        pollingRef.current = false;
        setTanDialog({ visible: false, challenge: '' });
        return;
      }
    }

    if (polls >= MAX_POLLS) {
      log.warn('TAN polling timed out during sync');
      pollingRef.current = false;
      setTanDialog({ visible: false, challenge: '' });
    }
  };

  const syncAccount = async (accountId: string) => {
    setSyncingAccounts((prev) => new Set(prev).add(accountId));
    log.info('Syncing transactions', { accountId });
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/transactions/refresh`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.status === 'tan_required') {
        log.info('TAN required for transaction sync', { accountId, referenceId: data.referenceId });
        setTanDialog({ visible: true, challenge: data.tanChallenge || 'Please approve in your banking app' });
        await pollFinTSTan(data.referenceId, accountId);
      } else {
        log.info('Transaction sync complete', { accountId, count: data.transactions?.length });
        await fetchConnections();
      }
    } catch (err) {
      log.error('Failed to sync transactions', err);
    } finally {
      setSyncingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const cancelTanPolling = () => {
    pollingRef.current = false;
    setTanDialog({ visible: false, challenge: '' });
    log.info('User cancelled TAN approval for sync');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/bank-connections/${deleteTarget}`, {
        method: 'DELETE',
      });
      setConnections((prev) => prev.filter((c) => c.id !== deleteTarget));
    } catch (err) {
      log.error('Failed to delete connection', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const isManual = (provider: string) => provider === 'manual';
  const isInvestment = (accountType: string): boolean => {
    log.info('Account Type', accountType);
    return accountType?.includes("investment")
  }

  return (
    <View style={styles.container}>
      {loading && !refreshing && <ActivityIndicator style={{ marginVertical: 16 }} />}

      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No bank accounts connected.</Text> : null
        }
        ItemSeparatorComponent={() => <Divider style={styles.divider} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title
              title={item.institutionId}
              subtitle={isManual(item.provider) ? 'Manual' : item.provider}
              right={(props) => (
                <IconButton
                  {...props}
                  icon="delete-outline"
                  onPress={() => setDeleteTarget(item.id)}
                />
              )}
            />
            <Card.Content>
              {item.accounts.map((account, index) => (
                <View key={account.id}>
                  {index > 0 && <Divider />}
                  <List.Item
                    title={account.ownerName || account.externalId}
                    description={`${account.name}\n${formatSyncTime(account.lastSyncedAt)}`}
                    right={() =>
                      !isManual(item.provider) && !isInvestment(account.accountType!)
                        ? (
                          syncingAccounts.has(account.id) ? (
                            <ActivityIndicator size="small" style={styles.syncIndicator} />
                          ) : (
                            <IconButton
                              icon="sync"
                              onPress={() => syncAccount(account.id)}
                            />
                          )
                        ) : null
                    }
                    style={styles.accountItem}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      />

      <Button
        mode="contained"
        style={styles.linkButton}
        icon="bank-plus"
        onPress={() => navigation.navigate('LinkBank')}
      >
        Link New Bank
      </Button>

      <Button
        mode="contained"
        style={styles.fintsButton}
        icon="bank-transfer"
        onPress={() => navigation.navigate('LinkFinTS')}
      >
        Link ING (FinTS)
      </Button>

      <Button
        mode="outlined"
        style={styles.manualButton}
        icon="pencil-plus-outline"
        onPress={() => navigation.navigate('AddManualAccount')}
      >
        Add Account Manually
      </Button>

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

        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>Disconnect Bank</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              This will permanently delete all accounts and balance history for this connection. Reconnecting later will require reloading all data, which uses limited API resources.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onPress={confirmDelete} textColor="red">Disconnect</Button>
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
  list: {
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.6,
  },
  divider: {
    marginVertical: 4,
  },
  card: {
    marginVertical: 4,
  },
  accountItem: {
    paddingHorizontal: 0,
  },
  syncIndicator: {
    alignSelf: 'center',
    marginRight: 12,
  },
  linkButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  fintsButton: {
    marginBottom: 8,
  },
  manualButton: {
    marginBottom: 8,
  },
});
