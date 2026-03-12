import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { en, registerTranslation } from 'react-native-paper-dates';

registerTranslation('en', en);

import OverviewScreen from './src/screens/OverviewScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LinkBankScreen from './src/screens/LinkBankScreen';
import AddManualAccountScreen from './src/screens/AddManualAccountScreen';
import CreateEditGoalScreen from './src/screens/CreateEditGoalScreen';
import GoalDetailScreen from './src/screens/GoalDetailScreen';

const Tab = createBottomTabNavigator();
const GoalsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Overview: 'home-outline',
  Goals: 'target',
  Family: 'account-group-outline',
  'Bank Accounts': 'bank',
};

function GoalsStackScreen() {
  return (
    <GoalsStack.Navigator>
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
    <SettingsStack.Navigator>
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

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Bank Accounts"
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
          <Tab.Screen name="Goals" component={GoalsStackScreen} options={{ headerShown: false }} />
          <Tab.Screen name="Family" component={FamilyScreen} />
          <Tab.Screen name="Bank Accounts" component={BankAccountsStackScreen} options={{ headerShown: false }} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}
