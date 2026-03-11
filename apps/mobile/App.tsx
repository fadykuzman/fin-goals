import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import OverviewScreen from './src/screens/OverviewScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LinkBankScreen from './src/screens/LinkBankScreen';

const Tab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Overview: 'home-outline',
  Goals: 'target',
  Family: 'account-group-outline',
  Settings: 'cog-outline',
};

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="LinkBank"
        component={LinkBankScreen}
        options={{ title: 'Link a Bank' }}
      />
    </SettingsStack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Settings"
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name={TAB_ICONS[route.name] as any}
                size={size}
                color={color}
              />
            ),
          })}
        >
          <Tab.Screen name="Overview" component={OverviewScreen} />
          <Tab.Screen name="Goals" component={GoalsScreen} />
          <Tab.Screen name="Family" component={FamilyScreen} />
          <Tab.Screen name="Settings" component={SettingsStackScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}
