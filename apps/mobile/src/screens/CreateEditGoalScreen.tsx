import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  Snackbar,
  Checkbox,
  Chip,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { DatePickerInput } from 'react-native-paper-dates';

const API_BASE = 'https://fedora.foxhound-shark.ts.net';
const USER_ID = 'test-user-1'; // placeholder until auth

interface AccountOption {
  id: string;
  name: string;
  connectionName: string;
}

interface GoalDetail {
  id: string;
  name: string;
  goalType: string;
  targetAmount: number;
  initialAmount: number;
  matchPattern: string | null;
  currency: string;
  deadline: string;
  interval: string;
  accounts: { accountId: string }[];
}

export default function CreateEditGoalScreen({ route, navigation }: { route: any; navigation: any }) {
  const goalId: string | undefined = route.params?.goalId;
  const isEdit = !!goalId;

  // Form state
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState('balance_based');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [matchPatterns, setMatchPatterns] = useState<string[]>([]);
  const [patternInput, setPatternInput] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [interval, setInterval] = useState('monthly');

  const formatWithCommas = (value: string): string => {
    const raw = value.replace(/[^0-9.]/g, '');
    const [intPart, decPart] = raw.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
  };

  // Account picker state
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingGoal, setLoadingGoal] = useState(isEdit);

  // Fetch available accounts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bank-connections?userId=${USER_ID}`);
        const data = await res.json();
        const accounts: AccountOption[] = [];
        for (const conn of data.connections ?? []) {
          for (const acc of conn.accounts ?? []) {
            accounts.push({
              id: acc.id,
              name: acc.name || acc.ownerName || 'Unknown Account',
              connectionName: conn.institutionId || 'Manual',
            });
          }
        }
        setAvailableAccounts(accounts);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, []);

  // Fetch goal details when editing
  useEffect(() => {
    if (!goalId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/goals/${goalId}`);
        const data = await res.json();
        const goal: GoalDetail = data.goal;
        setName(goal.name);
        setGoalType(goal.goalType);
        setTargetAmount(String(goal.targetAmount));
        setInitialAmount(String(goal.initialAmount));
        setMatchPatterns(goal.matchPattern ? goal.matchPattern.split(',').map((p: string) => p.trim()).filter(Boolean) : []);
        setCurrency(goal.currency);
        setDeadline(new Date(goal.deadline));
        setInterval(goal.interval);
        setSelectedAccountIds(new Set(goal.accounts.map((a) => a.accountId)));
      } catch (err) {
        console.error('Failed to fetch goal:', err);
        setError('Failed to load goal');
      } finally {
        setLoadingGoal(false);
      }
    })();
  }, [goalId]);

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }, []);

  const parseAmount = (value: string): number => Number(value.replace(/,/g, ''));

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required';
    const target = parseAmount(targetAmount);
    if (!targetAmount.trim() || isNaN(target) || target <= 0) return 'Target amount must be greater than 0';
    if (initialAmount.trim() && isNaN(parseAmount(initialAmount))) return 'Initial amount must be a number';
    if (goalType === 'transaction_based' && matchPatterns.length === 0) return 'At least one match pattern is required for transaction-based goals';
    if (!currency.trim()) return 'Currency is required';
    if (!deadline) return 'Deadline is required';
    if (!isEdit && deadline <= new Date()) return 'Deadline must be in the future';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        // Update goal fields
        const patchRes = await fetch(`${API_BASE}/api/goals/${goalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            goalType,
            targetAmount: parseAmount(targetAmount),
            initialAmount: parseAmount(initialAmount || '0'),
            matchPattern: goalType === 'transaction_based' ? matchPatterns.join(', ') : null,
            currency: currency.trim(),
            deadline: deadline!.toISOString(),
            interval,
          }),
        });
        if (!patchRes.ok) {
          const data = await patchRes.json();
          setError(data.error || 'Failed to update goal');
          return;
        }

        // Sync linked accounts: figure out what to link/unlink
        const detailRes = await fetch(`${API_BASE}/api/goals/${goalId}`);
        const detailData = await detailRes.json();
        const currentIds = new Set(detailData.goal.accounts.map((a: any) => a.accountId));

        const toLink = [...selectedAccountIds].filter((id) => !currentIds.has(id));
        const toUnlink = [...currentIds].filter((id: string) => !selectedAccountIds.has(id));

        if (toLink.length > 0) {
          await fetch(`${API_BASE}/api/goals/${goalId}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountIds: toLink }),
          });
        }
        for (const accountId of toUnlink) {
          await fetch(`${API_BASE}/api/goals/${goalId}/accounts/${accountId}`, {
            method: 'DELETE',
          });
        }
      } else {
        // Create goal
        const createRes = await fetch(`${API_BASE}/api/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            goalType,
            targetAmount: parseAmount(targetAmount),
            initialAmount: parseAmount(initialAmount || '0'),
            matchPattern: goalType === 'transaction_based' ? matchPatterns.join(', ') : null,
            currency: currency.trim(),
            deadline: deadline!.toISOString(),
            interval,
            userId: USER_ID,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          setError(createData.error || 'Failed to create goal');
          return;
        }

        // Link selected accounts
        if (selectedAccountIds.size > 0) {
          await fetch(`${API_BASE}/api/goals/${createData.goal.id}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountIds: [...selectedAccountIds] }),
          });
        }
      }

      navigation.goBack();
    } catch (err) {
      console.error('Failed to save goal:', err);
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingGoal) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text variant="labelLarge" style={styles.label}>Name</Text>
      <TextInput
        mode="outlined"
        placeholder="e.g. Emergency Fund, Vacation"
        value={name}
        onChangeText={setName}
      />

      <Text variant="labelLarge" style={styles.label}>Goal Type</Text>
      <SegmentedButtons
        value={goalType}
        onValueChange={setGoalType}
        buttons={[
          { value: 'balance_based', label: 'Balance-based' },
          { value: 'transaction_based', label: 'Transaction-based' },
        ]}
      />

      {goalType === 'transaction_based' && (
        <>
          <Text variant="labelLarge" style={styles.label}>Match Patterns</Text>
          {matchPatterns.length > 0 && (
            <View style={styles.chipContainer}>
              {matchPatterns.map((pattern, index) => (
                <Chip
                  key={index}
                  onClose={() => setMatchPatterns((prev) => prev.filter((_, i) => i !== index))}
                  style={styles.chip}
                >
                  {pattern}
                </Chip>
              ))}
            </View>
          )}
          <TextInput
            mode="outlined"
            placeholder="Type a keyword and press enter"
            value={patternInput}
            onChangeText={setPatternInput}
            onSubmitEditing={() => {
              const trimmed = patternInput.trim();
              if (trimmed && !matchPatterns.includes(trimmed)) {
                setMatchPatterns((prev) => [...prev, trimmed]);
              }
              setPatternInput('');
            }}
            returnKeyType="done"
          />
          <Text variant="bodySmall" style={styles.hint}>
            Transactions matching any keyword will count toward this goal (case-insensitive).
          </Text>
        </>
      )}

      <Text variant="labelLarge" style={styles.label}>Target Amount</Text>
      <TextInput
        mode="outlined"
        placeholder="0.00"
        value={targetAmount}
        onChangeText={(v) => setTargetAmount(formatWithCommas(v))}
        keyboardType="decimal-pad"
      />

      <Text variant="labelLarge" style={styles.label}>Initial Amount</Text>
      <TextInput
        mode="outlined"
        placeholder="0.00"
        value={initialAmount}
        onChangeText={(v) => setInitialAmount(formatWithCommas(v))}
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

      <Text variant="labelLarge" style={styles.label}>Deadline</Text>
      <DatePickerInput
        locale="en"
        mode="outlined"
        value={deadline}
        onChange={setDeadline}
        inputMode="start"
      />

      <Text variant="labelLarge" style={styles.label}>Interval</Text>
      <SegmentedButtons
        value={interval}
        onValueChange={setInterval}
        buttons={[
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ]}
      />

      <Divider style={styles.divider} />
      <Text variant="titleMedium" style={styles.sectionTitle}>Link Accounts (optional)</Text>

      {loadingAccounts ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : availableAccounts.length === 0 ? (
        <Text style={styles.noAccounts}>No accounts available to link.</Text>
      ) : (
        availableAccounts.map((account) => (
          <Checkbox.Item
            key={account.id}
            label={`${account.name} (${account.connectionName})`}
            status={selectedAccountIds.has(account.id) ? 'checked' : 'unchecked'}
            onPress={() => toggleAccount(account.id)}
          />
        ))
      )}

      <Button
        mode="contained"
        style={styles.submitButton}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
      >
        {isEdit ? 'Save Changes' : 'Create Goal'}
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  label: {
    marginTop: 16,
    marginBottom: 4,
  },
  divider: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginBottom: 0,
  },
  hint: {
    opacity: 0.6,
    marginTop: 4,
  },
  noAccounts: {
    opacity: 0.6,
    marginVertical: 8,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 32,
  },
});
