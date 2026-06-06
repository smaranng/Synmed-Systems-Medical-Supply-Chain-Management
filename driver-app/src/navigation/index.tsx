import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../components/ui';

import LoginScreen          from '../screens/LoginScreen';
import HomeScreen           from '../screens/HomeScreen';
import DeliveriesScreen     from '../screens/DeliveriesScreen';
import DeliveryDetailScreen from '../screens/DeliveryDetailScreen';
import ProfileScreen        from '../screens/ProfileScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type AppStackParamList = {
  Tabs:           undefined;
  DeliveryDetail: { deliveryID: string };
};

type TabParamList = {
  Home:       undefined;
  Deliveries: undefined;
  Profile:    undefined;
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle:       { backgroundColor: Colors.primary },
        headerTintColor:   '#fff',
        headerTitleStyle:  { fontWeight: '700' },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          paddingBottom: 6,
          height: 60,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
            Home:       { active: 'home',        inactive: 'home-outline' },
            Deliveries: { active: 'cube',         inactive: 'cube-outline' },
            Profile:    { active: 'person-circle', inactive: 'person-circle-outline' },
          };
          const icon = icons[route.name];
          return (
            <Ionicons
              name={focused ? icon.active : icon.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Deliveries"
        component={DeliveriesScreen}
        options={{ title: 'My Deliveries' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// ─── Root navigator — switches between Login and App ─────────────────────────

export default function RootNavigator() {
  const { driver, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {driver ? (
        // Authenticated — show main app with bottom tabs
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="DeliveryDetail"
            component={DeliveryDetailScreen}
            options={{
              headerShown: true,
              title: 'Delivery Details',
              headerStyle:       { backgroundColor: Colors.primary },
              headerTintColor:   '#fff',
              headerTitleStyle:  { fontWeight: '700' },
              headerBackTitle:   'Back',
            }}
          />
        </Stack.Navigator>
      ) : (
        // Not authenticated — show login
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
