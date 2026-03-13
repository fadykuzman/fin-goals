import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { en, registerTranslation } from 'react-native-paper-dates';

registerTranslation('en', en);

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import OverviewScreen from './src/screens/OverviewScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LinkBankScreen from './src/screens/LinkBankScreen';
import AddManualAccountScreen from './src/screens/AddManualAccountScreen';
import CreateEditGoalScreen from './src/screens/CreateEditGoalScreen';
import GoalDetailScreen from './src/screens/GoalDetailScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CheckEmailScreen from './src/screens/CheckEmailScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

const Tab = createBottomTabNavigator();
const GoalsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Overview: 'home-outline',
  Goals: 'target',
  Family: 'account-group-outline',
  'Bank Accounts': 'bank',
};

function SettingsHeaderButton() {
  const navigation = useNavigation<any>();
  return (
    <MaterialCommunityIcons
      name="cog-outline"
      size={24}
      style={{ marginRight: 16 }}
      onPress={() => navigation.navigate('AccountSettings')}
    />
  );
}

function GoalsStackScreen() {
  return (
    <GoalsStack.Navigator
      screenOptions={{ headerRight: () => <SettingsHeaderButton /> }}
    >
      <GoalsStack.Screen
        name="GoalsList"
        component={GoalsScreen}
        options={{ title: 'Goals' }}
      />
      <GoalsStack.Screen
        name="GoalDetail"
        component={GoalDetailScreen}
        options={{ title: 'Goal Details' }}
      />
      <GoalsStack.Screen
        name="CreateEditGoal"
        component={CreateEditGoalScreen}
        options={({ route }: { route: any }) => ({
          title: route.params?.goalId ? 'Edit Goal' : 'New Goal',
        })}
      />
    </GoalsStack.Navigator>
  );
}

function BankAccountsStackScreen() {
  return (
    <SettingsStack.Navigator
      screenOptions={{ headerRight: () => <SettingsHeaderButton /> }}
    >
      <SettingsStack.Screen
        name="BankAccountsHome"
        component={SettingsScreen}
        options={{ title: 'Bank Accounts' }}
      />
      <SettingsStack.Screen
        name="LinkBank"
        component={LinkBankScreen}
        options={{ title: 'Link a Bank' }}
      />
      <SettingsStack.Screen
        name="AddManualAccount"
        component={AddManualAccountScreen}
        options={{ title: 'Add Account Manually' }}
      />
    </SettingsStack.Navigator>
  );
}

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="CheckEmail" component={CheckEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs({ navigation }: { navigation: any }) {
  return (
    <Tab.Navigator
      initialRouteName="Overview"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={TAB_ICONS[route.name] as any}
            size={size}
            color={color}
          />
        ),
        headerRight: () => (
          <MaterialCommunityIcons
            name="cog-outline"
            size={24}
            style={{ marginRight: 16 }}
            onPress={() => navigation.navigate('AccountSettings')}
          />
        ),
      })}
    >
      <Tab.Screen name="Overview" component={OverviewScreen} />
      <Tab.Screen name="Goals" component={GoalsStackScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Family" component={FamilyScreen} />
      <Tab.Screen name="Bank Accounts" component={BankAccountsStackScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <AuthStackScreen />;

  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="AccountSettings"
        component={AccountSettingsScreen}
        options={{ title: 'Account Settings' }}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}
