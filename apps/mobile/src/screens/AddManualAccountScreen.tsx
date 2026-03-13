import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, Snackbar } from 'react-native-paper';
import { apiFetch } from '../config/api';

export default function AddManualAccountScreen({ navigation }: { navigation: any }) {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('cash');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [gainAmount, setGainAmount] = useState('');
  const [gainPercentage, setGainPercentage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount))) {
      setError('Valid amount is required');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create the manual connection + account
      const linkRes = await apiFetch('/api/bank-links/manual', {
        method: 'POST',
        body: JSON.stringify({
          accounts: [{ name: name.trim(), accountType }],
        }),
      });
      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        setError(linkData.error || 'Failed to create account');
        return;
      }

      const accountId = linkData.accounts[0].id;

      // Step 2: Record the initial balance
      const balanceBody: Record<string, string | number> = {
        amount: Number(amount),
        currency: currency.trim() || 'EUR',
      };
      if (accountType === 'investment' && gainAmount.trim()) {
        balanceBody.gainAmount = Number(gainAmount);
      }
      if (accountType === 'investment' && gainPercentage.trim()) {
        balanceBody.gainPercentage = Number(gainPercentage);
      }

      const balRes = await apiFetch(`/api/accounts/${accountId}/balances`, {
        method: 'POST',
        body: JSON.stringify(balanceBody),
      });

      if (!balRes.ok) {
        const balData = await balRes.json();
        setError(balData.error || 'Account created but failed to save balance');
        return;
      }

      navigation.goBack();
    } catch (err) {
      console.error('Failed to add manual account:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text variant="labelLarge" style={styles.label}>Account Name</Text>
      <TextInput
        mode="outlined"
        placeholder="e.g. Extra-Konto, Direkt-Depot"
        value={name}
        onChangeText={setName}
      />

      <Text variant="labelLarge" style={styles.label}>Account Type</Text>
      <SegmentedButtons
        value={accountType}
        onValueChange={setAccountType}
        buttons={[
          { value: 'cash', label: 'Cash' },
          { value: 'investment', label: 'Investment' },
        ]}
      />

      <Text variant="labelLarge" style={styles.label}>Balance</Text>
      <TextInput
        mode="outlined"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text variant="labelLarge" style={styles.label}>Currency</Text>
      <TextInput
        mode="outlined"
        placeholder="EUR"
        value={currency}
        onChangeText={setCurrency}
        autoCapitalize="characters"
      />

      {accountType === 'investment' && (
        <>
          <Text variant="labelLarge" style={styles.label}>Gain Amount</Text>
          <TextInput
            mode="outlined"
            placeholder="0.00"
            value={gainAmount}
            onChangeText={setGainAmount}
            keyboardType="decimal-pad"
          />

          <Text variant="labelLarge" style={styles.label}>Gain Percentage</Text>
          <TextInput
            mode="outlined"
            placeholder="0.00"
            value={gainPercentage}
            onChangeText={setGainPercentage}
            keyboardType="decimal-pad"
          />
        </>
      )}

      <Button
        mode="contained"
        style={styles.submitButton}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
      >
        Add Account
      </Button>

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={3000}>
        {error}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    marginTop: 16,
    marginBottom: 4,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 16,
  },
});
