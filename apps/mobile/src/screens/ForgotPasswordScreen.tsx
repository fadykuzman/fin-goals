import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

export default function ForgotPasswordScreen({ navigation }: { navigation: any }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err.message ?? 'Failed to send reset email.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          Email Sent
        </Text>
        <Text variant="bodyLarge" style={styles.body}>
          Check your email for a password reset link.
        </Text>
        <Button mode="contained" onPress={() => navigation.navigate('Login')} style={styles.button}>
          Back to Login
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Reset Password
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      {error ? <HelperText type="error">{error}</HelperText> : null}

      <Button mode="contained" onPress={handleReset} loading={loading} disabled={loading} style={styles.button}>
        Send Reset Link
      </Button>

      <Button onPress={() => navigation.navigate('Login')} style={styles.link}>
        Back to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 24 },
  body: { textAlign: 'center', marginBottom: 24 },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
  link: { marginTop: 8 },
});
