import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Text, Dialog, Portal, Paragraph, Snackbar, Divider } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../config/api';

export default function AccountSettingsScreen({ navigation }: { navigation: any }) {
  const { user, logout, resetPassword } = useAuth();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      setSnackbar({ visible: true, message: 'Password reset email sent. Check your inbox.' });
    } catch (err: any) {
      setSnackbar({ visible: true, message: err.message || 'Failed to send reset email.' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete account.');
      }
      await logout();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account.');
      setDeleting(false);
      setDeleteDialogVisible(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{user?.displayName}</Text>
          <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Button
        mode="outlined"
        icon="lock-reset"
        onPress={handleResetPassword}
        style={styles.button}
      >
        Reset Password
      </Button>

      <Button
        mode="outlined"
        icon="logout"
        onPress={logout}
        style={styles.button}
      >
        Log Out
      </Button>

      <Divider style={styles.divider} />

      <Button
        mode="outlined"
        icon="delete-alert-outline"
        textColor="red"
        onPress={() => setDeleteDialogVisible(true)}
        style={styles.deleteButton}
      >
        Delete Account
      </Button>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => !deleting && setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Account</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              This will permanently delete your account and all associated data including bank connections, balances, goals, and transactions. This action cannot be undone.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} disabled={deleting}>Cancel</Button>
            <Button onPress={handleDeleteAccount} textColor="red" loading={deleting} disabled={deleting}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={4000}
      >
        {snackbar.message}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 8,
  },
  email: {
    opacity: 0.6,
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  button: {
    marginBottom: 12,
  },
  deleteButton: {
    marginBottom: 12,
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 8,
  },
});
