import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, IconButton, Dialog, Portal, Paragraph, TextInput, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';

interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export default function FamilyScreen() {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // Create dialog
  const [createVisible, setCreateVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchFamily = useCallback(async () => {
    try {
      const res = await apiFetch('/api/families');
      if (res.ok) {
        const data = await res.json();
        setFamily(data.family);
        setIsOwner(data.isOwner);
      } else {
        setFamily(null);
        setIsOwner(false);
      }
    } catch (err) {
      console.error('Failed to fetch family:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchFamily();
    }, [fetchFamily])
  );

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch('/api/families', {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (res.ok) {
        setCreateVisible(false);
        setCreateName('');
        await fetchFamily();
      }
    } catch (err) {
      console.error('Failed to create family:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editName.trim() || !family) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/families/${family.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditVisible(false);
        await fetchFamily();
      }
    } catch (err) {
      console.error('Failed to update family:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!family) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/families/${family.id}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        setDeleteVisible(false);
        setFamily(null);
        setIsOwner(false);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete family');
      }
    } catch (err) {
      console.error('Failed to delete family:', err);
      setDeleteError('Failed to delete family');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!family) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          You're not part of a family yet.
        </Text>
        <Button mode="contained" icon="account-group" onPress={() => setCreateVisible(true)}>
          Create Family
        </Button>

        <Portal>
          <Dialog visible={createVisible} onDismiss={() => setCreateVisible(false)}>
            <Dialog.Title>Create Family</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Family name"
                value={createName}
                onChangeText={setCreateName}
                autoFocus
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setCreateVisible(false)}>Cancel</Button>
              <Button onPress={handleCreate} loading={creating} disabled={!createName.trim() || creating}>
                Create
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title
          title={family.name}
          subtitle="Your family"
          right={(props) =>
            isOwner ? (
              <View style={styles.actions}>
                <IconButton
                  {...props}
                  icon="pencil-outline"
                  onPress={() => {
                    setEditName(family.name);
                    setEditVisible(true);
                  }}
                />
                <IconButton
                  {...props}
                  icon="delete-outline"
                  onPress={() => {
                    setDeleteError(null);
                    setDeleteVisible(true);
                  }}
                />
              </View>
            ) : null
          }
        />
      </Card>

      <Portal>
        <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)}>
          <Dialog.Title>Rename Family</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Family name"
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditVisible(false)}>Cancel</Button>
            <Button onPress={handleEdit} loading={saving} disabled={!editName.trim() || saving}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteVisible} onDismiss={() => setDeleteVisible(false)}>
          <Dialog.Title>Delete Family</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete this family? This action cannot be undone.
            </Paragraph>
            {deleteError && (
              <Text style={styles.errorText}>{deleteError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteVisible(false)}>Cancel</Button>
            <Button onPress={handleDelete} loading={deleting} disabled={deleting} textColor="red">
              Delete
            </Button>
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
    padding: 16,
  },
  emptyText: {
    marginBottom: 16,
    opacity: 0.6,
  },
  card: {
    marginVertical: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
