import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function CheckEmailScreen({ navigation }: { navigation: any }) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="email-check-outline" size={64} color="#6200ee" style={styles.icon} />

      <Text variant="headlineMedium" style={styles.title}>
        Check Your Email
      </Text>

      <Text variant="bodyLarge" style={styles.body}>
        We've sent a verification link to your email address. Please verify your email before logging in.
      </Text>

      <Button mode="contained" onPress={() => navigation.navigate('Login')} style={styles.button}>
        Back to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  icon: { marginBottom: 16 },
  title: { textAlign: 'center', marginBottom: 16 },
  body: { textAlign: 'center', marginBottom: 24, paddingHorizontal: 16 },
  button: { alignSelf: 'stretch' },
});
