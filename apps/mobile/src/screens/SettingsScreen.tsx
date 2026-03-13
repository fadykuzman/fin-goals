import { useState, useCallback } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { Button, Card, Text, IconButton, ActivityIndicator, Divider, Dialog, Portal, Paragraph, List } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';

interface Account {
  id: string;
  externalId: string;
  name: string | null;
  ownerName: string | null;
  lastSyncedAt: string | null;
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

  const fetchConnections = useCallback(async () => {
    try {
      const res = await apiFetch('/api/bank-connections');
      const data = await res.json();
      setConnections(data.connections);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
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

  const syncAccount = async (accountId: string) => {
    setSyncingAccounts((prev) => new Set(prev).add(accountId));
    try {
      await apiFetch(`/api/accounts/${accountId}/transactions/refresh`, {
        method: 'POST',
      });
      await fetchConnections();
    } catch (err) {
      console.error('Failed to sync transactions:', err);
    } finally {
      setSyncingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/bank-connections/${deleteTarget}`, {
        method: 'DELETE',
      });
      setConnections((prev) => prev.filter((c) => c.id !== deleteTarget));
    } catch (err) {
      console.error('Failed to delete connection:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const isManual = (provider: string) => provider === 'manual';

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
                    title={account.name || account.ownerName || account.externalId}
                    description={formatSyncTime(account.lastSyncedAt)}
                    right={() =>
                      !isManual(item.provider) ? (
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
        mode="outlined"
        style={styles.manualButton}
        icon="pencil-plus-outline"
        onPress={() => navigation.navigate('AddManualAccount')}
      >
        Add Account Manually
      </Button>

      <Portal>
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
  manualButton: {
    marginBottom: 8,
  },
});
