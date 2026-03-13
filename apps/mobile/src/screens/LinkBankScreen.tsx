import { useState } from 'react';
import { FlatList, View, StyleSheet, Linking } from 'react-native';
import { Text, TextInput, List, ActivityIndicator, Divider } from 'react-native-paper';
import { apiFetch } from '../config/api';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const CALLBACK_URL = `${API_BASE}/api/bank-links/callback`;

const COUNTRIES = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'GB', name: 'United Kingdom' },
];

interface Institution {
  id: string;
  name: string;
  logo: string;
}

export default function LinkBankScreen({ navigation }: { navigation: any }) {
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string } | null>(null);
  const [showCountryList, setShowCountryList] = useState(false);

  const [bankSearch, setBankSearch] = useState('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [linking, setLinking] = useState(false);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredBanks = institutions.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const handleSelectCountry = async (country: { code: string; name: string }) => {
    setSelectedCountry(country);
    setCountrySearch(country.name);
    setShowCountryList(false);
    setBankSearch('');
    setLoadingBanks(true);
    try {
      const res = await apiFetch(`/api/banks?country=${country.code}`);
      const data = await res.json();
      setInstitutions(data);
    } catch (err) {
      console.error('Failed to fetch banks:', err);
      setInstitutions([]);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleLinkBank = async (institutionId: string) => {
    setLinking(true);
    try {
      const res = await apiFetch('/api/bank-links', {
        method: 'POST',
        body: JSON.stringify({
          institutionId,
          redirectUrl: CALLBACK_URL,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) {
        console.error('Bank link error:', data.error ?? 'No link returned');
        return;
      }
      await Linking.openURL(data.link);
      navigation.goBack();
    } catch (err) {
      console.error('Failed to initiate bank link:', err);
    } finally {
      setLinking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="labelLarge" style={styles.label}>Country</Text>
      <TextInput
        mode="outlined"
        placeholder="Search country..."
        value={countrySearch}
        onChangeText={(text) => {
          setCountrySearch(text);
          setShowCountryList(true);
          if (selectedCountry && text !== selectedCountry.name) {
            setSelectedCountry(null);
            setInstitutions([]);
          }
        }}
        onFocus={() => setShowCountryList(true)}
        right={selectedCountry ? <TextInput.Icon icon="check" color="green" /> : undefined}
      />

      {showCountryList && !selectedCountry && (
        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.code}
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              onPress={() => handleSelectCountry(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No countries match.</Text>
          }
        />
      )}

      {selectedCountry && (
        <>
          <Text variant="labelLarge" style={styles.label}>Bank</Text>
          <TextInput
            mode="outlined"
            placeholder="Search bank..."
            value={bankSearch}
            onChangeText={setBankSearch}
          />

          {loadingBanks && <ActivityIndicator style={{ marginVertical: 16 }} />}

          {!loadingBanks && (
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.id}
              style={styles.bankList}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }) => (
                <List.Item
                  title={item.name}
                  onPress={() => handleLinkBank(item.id)}
                  disabled={linking}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No banks found.</Text>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
  },
  dropdown: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  bankList: {
    flex: 1,
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    padding: 16,
    opacity: 0.6,
  },
});
