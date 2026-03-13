import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Button, Card, IconButton, Dialog, Portal, Paragraph, TextInput, ActivityIndicator, Chip, List, Divider, Snackbar } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('Family');

interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: 'owner' | 'member';
}

interface SentInvite {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface ReceivedInvite {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  family: { id: string; name: string };
  invitedBy: { displayName: string };
}

export default function FamilyScreen() {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  // Invites
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<ReceivedInvite[]>([]);

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

  // Remove member dialog
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  // Leave dialog
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Invite dialog
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const fetchReceivedInvites = useCallback(async () => {
    try {
      const res = await apiFetch('/api/invites');
      if (res.ok) {
        setReceivedInvites(await res.json());
      }
    } catch (err) {
      log.error('Failed to fetch received invites', err);
    }
  }, []);

  const fetchFamily = useCallback(async () => {
    try {
      const res = await apiFetch('/api/families');
      if (res.ok) {
        const data = await res.json();
        setFamily(data.family);
        setIsOwner(data.isOwner);
        if (data.family) {
          const membersRes = await apiFetch(`/api/families/${data.family.id}/members`);
          if (membersRes.ok) {
            setMembers(await membersRes.json());
          }
          if (data.isOwner) {
            const invitesRes = await apiFetch(`/api/families/${data.family.id}/invites`);
            if (invitesRes.ok) {
              setSentInvites(await invitesRes.json());
            }
          }
        } else {
          setMembers([]);
          setSentInvites([]);
          await fetchReceivedInvites();
        }
      } else {
        setFamily(null);
        setIsOwner(false);
        setMembers([]);
        setSentInvites([]);
        await fetchReceivedInvites();
      }
    } catch (err) {
      log.error('Failed to fetch family', err);
    } finally {
      setLoading(false);
    }
  }, [fetchReceivedInvites]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchFamily();
    }, [fetchFamily])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFamily();
    setRefreshing(false);
  }, [fetchFamily]);

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
      log.error('Failed to create family', err);
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
      log.error('Failed to update family', err);
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
        setMembers([]);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete family');
      }
    } catch (err) {
      log.error('Failed to delete family', err);
      setDeleteError('Failed to delete family');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!family || !removeTarget) return;
    setRemoving(true);
    try {
      const res = await apiFetch(`/api/families/${family.id}/members/${removeTarget.userId}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        setRemoveTarget(null);
        await fetchFamily();
      }
    } catch (err) {
      log.error('Failed to remove member', err);
    } finally {
      setRemoving(false);
    }
  };

  const handleLeave = async () => {
    if (!family) return;
    setLeaving(true);
    try {
      const res = await apiFetch(`/api/families/${family.id}/leave`, {
        method: 'POST',
      });
      if (res.ok || res.status === 204) {
        setLeaveVisible(false);
        setFamily(null);
        setIsOwner(false);
        setMembers([]);
      }
    } catch (err) {
      log.error('Failed to leave family', err);
    } finally {
      setLeaving(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !family) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await apiFetch(`/api/families/${family.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (res.ok) {
        setInviteVisible(false);
        setInviteEmail('');
        setSnackbar('Invite sent');
        await fetchFamily();
      } else {
        const data = await res.json();
        setInviteError(data.error || 'Failed to send invite');
      }
    } catch (err) {
      log.error('Failed to send invite', err);
      setInviteError('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await apiFetch(`/api/invites/${inviteId}/accept`, {
        method: 'POST',
      });
      if (res.ok) {
        setSnackbar('Invite accepted');
        await fetchFamily();
      } else {
        const data = await res.json();
        setSnackbar(data.error || 'Failed to accept invite');
      }
    } catch (err) {
      log.error('Failed to accept invite', err);
      setSnackbar('Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      const res = await apiFetch(`/api/invites/${inviteId}/decline`, {
        method: 'POST',
      });
      if (res.ok) {
        setSnackbar('Invite declined');
        setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        const data = await res.json();
        setSnackbar(data.error || 'Failed to decline invite');
      }
    } catch (err) {
      log.error('Failed to decline invite', err);
      setSnackbar('Failed to decline invite');
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
      <ScrollView
        contentContainerStyle={styles.noFamilyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="bodyLarge" style={styles.emptyText}>
          You're not part of a family yet.
        </Text>
        <Button mode="contained" icon="account-group" onPress={() => setCreateVisible(true)}>
          Create Family
        </Button>

        {receivedInvites.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Pending Invites
            </Text>
            {receivedInvites.map((invite) => (
              <Card key={invite.id} style={styles.card}>
                <Card.Title
                  title={invite.family.name}
                  subtitle={`Invited by ${invite.invitedBy.displayName}`}
                />
                <Card.Actions>
                  <Button onPress={() => handleDeclineInvite(invite.id)}>Decline</Button>
                  <Button mode="contained" onPress={() => handleAcceptInvite(invite.id)}>
                    Accept
                  </Button>
                </Card.Actions>
              </Card>
            ))}
          </>
        )}

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

        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
          {snackbar || ''}
        </Snackbar>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
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

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Members ({members.length})
      </Text>

      <Card style={styles.card}>
        {members.map((member, index) => (
          <View key={member.userId}>
            {index > 0 && <Divider />}
            <List.Item
              title={member.displayName}
              description={member.email}
              right={() => (
                <View style={styles.memberRight}>
                  {member.role === 'owner' && (
                    <Chip compact textStyle={styles.chipText}>Owner</Chip>
                  )}
                  {isOwner && member.role !== 'owner' && (
                    <IconButton
                      icon="account-remove-outline"
                      size={20}
                      onPress={() => setRemoveTarget(member)}
                    />
                  )}
                </View>
              )}
            />
          </View>
        ))}
      </Card>

      {isOwner && (
        <>
          <Button
            mode="outlined"
            icon="email-plus-outline"
            style={styles.inviteButton}
            onPress={() => {
              setInviteEmail('');
              setInviteError(null);
              setInviteVisible(true);
            }}
          >
            Invite Member
          </Button>

          {sentInvites.length > 0 && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Pending Invites ({sentInvites.length})
              </Text>
              <Card style={styles.card}>
                {sentInvites.map((invite, index) => (
                  <View key={invite.id}>
                    {index > 0 && <Divider />}
                    <List.Item
                      title={invite.email}
                      description={`Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      left={(props) => <List.Icon {...props} icon="email-outline" />}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {!isOwner && (
        <Button
          mode="outlined"
          textColor="red"
          style={styles.leaveButton}
          onPress={() => setLeaveVisible(true)}
        >
          Leave Family
        </Button>
      )}

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

        <Dialog visible={!!removeTarget} onDismiss={() => setRemoveTarget(null)}>
          <Dialog.Title>Remove Member</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Remove {removeTarget?.displayName} from the family?
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveTarget(null)}>Cancel</Button>
            <Button onPress={handleRemoveMember} loading={removing} disabled={removing} textColor="red">
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={leaveVisible} onDismiss={() => setLeaveVisible(false)}>
          <Dialog.Title>Leave Family</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to leave this family?
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLeaveVisible(false)}>Cancel</Button>
            <Button onPress={handleLeave} loading={leaving} disabled={leaving} textColor="red">
              Leave
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={inviteVisible} onDismiss={() => setInviteVisible(false)}>
          <Dialog.Title>Invite Member</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            {inviteError && (
              <Text style={styles.errorText}>{inviteError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInviteVisible(false)}>Cancel</Button>
            <Button onPress={handleSendInvite} loading={inviting} disabled={!inviteEmail.trim() || inviting}>
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar || ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  noFamilyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  sectionTitle: {
    marginTop: 16,
    marginBottom: 4,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12,
  },
  inviteButton: {
    marginTop: 12,
  },
  leaveButton: {
    marginTop: 16,
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
