import { useState } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { Button, Card, Text, IconButton, ActivityIndicator, Divider, Dialog, Portal, Paragraph } from 'react-native-paper';
import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE = 'https://fedora.foxhound-shark.ts.net';
const USER_ID = 'test-user-1'; // placeholder until auth

interface Account {
  id: string;
  externalId: string;
  name: string | null;
  ownerName: string | null;
}

interface BankConnection {
  id: string;
  institutionId: string;
  status: string;
  createdAt: string;
  accounts: Account[];
}

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/bank-connections?userId=${USER_ID}`);
      const data = await res.json();
      setConnections(data.connections);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  }, [fetchConnections]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/api/bank-connections/${deleteTarget}`, {
        method: 'DELETE',
      });
      setConnections((prev) => prev.filter((c) => c.id !== deleteTarget));
    } catch (err) {
      console.error('Failed to delete connection:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.header}>Bank Connections</Text>

      {loading && <ActivityIndicator style={{ marginVertical: 16 }} />}

      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No bank accounts connected.</Text>
        }
        ItemSeparatorComponent={() => <Divider style={styles.divider} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title
              title={item.institutionId}
              subtitle={item.accounts
                .map((a) => a.name || a.ownerName || a.externalId)
                .join(', ')}
              right={(props) => (
                <IconButton
                  {...props}
                  icon="delete-outline"
                  onPress={() => setDeleteTarget(item.id)}
                />
              )}
            />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 16,
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
  linkButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  manualButton: {
    marginBottom: 8,
  },
});
