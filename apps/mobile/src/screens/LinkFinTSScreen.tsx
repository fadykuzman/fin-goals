import { useState, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Portal, Dialog, Paragraph } from 'react-native-paper';
import { apiFetch } from '../config/api';
import { createLogger } from '../config/logger';

const log = createLogger('LinkFinTS');

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100; // 5 minutes at 3s intervals

export default function LinkFinTSScreen({ navigation }: { navigation: any }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [blz, setBlz] = useState('50010517'); // ING default
  const [linking, setLinking] = useState(false);
  const [tanPending, setTanPending] = useState(false);
  const [tanChallenge, setTanChallenge] = useState('');
  const [error, setError] = useState('');
  const pollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
  }, []);

  const pollTan = useCallback(async (referenceId: string, endpoint: string) => {
    pollingRef.current = true;
    let polls = 0;

    while (pollingRef.current && polls < MAX_POLLS) {
      polls++;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      if (!pollingRef.current) break;

      try {
        log.info(`Polling TAN approval (attempt ${polls})`);
        const res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ referenceId }),
        });
        const data = await res.json();

        if (data.status === 'linked') {
          log.info('FinTS linking complete', { connectionId: data.connectionId, accountCount: data.accounts?.length });
          pollingRef.current = false;
          setTanPending(false);
          setLinking(false);
          navigation.goBack();
          return;
        }

        if (data.status !== 'pending') {
          log.error('Unexpected poll response', data);
          pollingRef.current = false;
          setTanPending(false);
          setLinking(false);
          setError(data.error || 'Linking failed');
          return;
        }
      } catch (err) {
        log.error('Poll request failed', err);
        pollingRef.current = false;
        setTanPending(false);
        setLinking(false);
        setError('Connection error while waiting for TAN approval');
        return;
      }
    }

    if (polls >= MAX_POLLS) {
      log.warn('TAN polling timed out');
      pollingRef.current = false;
      setTanPending(false);
      setLinking(false);
      setError('TAN approval timed out. Please try again.');
    }
  }, [navigation]);

  const handleLink = async () => {
    if (!username || !pin || !blz) {
      setError('All fields are required');
      return;
    }

    setError('');
    setLinking(true);
    log.info('Initiating FinTS link', { blz });

    try {
      const res = await apiFetch('/api/bank-links/fints', {
        method: 'POST',
        body: JSON.stringify({ username, pin, blz }),
      });
      const data = await res.json();

      if (!res.ok) {
        log.error('FinTS link request failed', { status: res.status, error: data.error });
        setError(data.error || 'Failed to connect');
        setLinking(false);
        return;
      }

      if (data.status === 'tan_required') {
        log.info('TAN required for FinTS linking', { referenceId: data.referenceId });
        setTanChallenge(data.tanChallenge || 'Please approve the login in your banking app');
        setTanPending(true);
        pollTan(data.referenceId, '/api/bank-links/fints/poll');
        return;
      }

      if (data.status === 'linked') {
        log.info('FinTS linked immediately (no TAN)', { connectionId: data.connectionId });
        navigation.goBack();
      }
    } catch (err) {
      log.error('FinTS link error', err);
      setError('Connection error');
      setLinking(false);
    }
  };

  const handleCancel = () => {
    stopPolling();
    setTanPending(false);
    setLinking(false);
    log.info('User cancelled TAN approval');
  };

  return (
    <View style={styles.container}>
      <Text variant="bodyMedium" style={styles.description}>
        Connect your ING DiBa account via FinTS. You will need your Zugangsnummer and online banking PIN.
      </Text>

      <TextInput
        label="Zugangsnummer"
        mode="outlined"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        disabled={linking}
        style={styles.input}
      />

      <TextInput
        label="PIN"
        mode="outlined"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        disabled={linking}
        style={styles.input}
      />

      <TextInput
        label="BLZ"
        mode="outlined"
        value={blz}
        onChangeText={setBlz}
        keyboardType="number-pad"
        disabled={linking}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleLink}
        loading={linking && !tanPending}
        disabled={linking}
        style={styles.button}
      >
        Connect
      </Button>

      <Portal>
        <Dialog visible={tanPending} dismissable={false}>
          <Dialog.Title>Approve in Banking App</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{tanChallenge}</Paragraph>
            <ActivityIndicator style={styles.dialogSpinner} />
            <Paragraph style={styles.waitingText}>Waiting for approval...</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancel}>Cancel</Button>
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
  description: {
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  dialogSpinner: {
    marginVertical: 16,
  },
  waitingText: {
    textAlign: 'center',
    opacity: 0.6,
  },
});
