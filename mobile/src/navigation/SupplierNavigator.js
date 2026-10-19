import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, Inbox, History, Bell } from 'lucide-react-native';

import SupplierDashboardScreen from '../screens/supplier/DashboardScreen.js';
import RequestsScreen from '../screens/supplier/RequestsScreen.js';
import RequestDetailScreen from '../screens/supplier/RequestDetailScreen.js';
import HistoryScreen from '../screens/supplier/HistoryScreen.js';
import NotificationsScreen from '../screens/supplier/NotificationsScreen.js';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SupplierTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#A3A3A3',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5E5',
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={SupplierDashboardScreen}
        options={{ tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarIcon: ({ color }) => <Inbox size={22} color={color} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <History size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ tabBarIcon: ({ color }) => <Bell size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function SupplierNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#000000',
        headerTitleStyle: { fontWeight: '600', color: '#0A0A0A' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F5F5F5' },
      }}
    >
      <Stack.Screen name="Tabs" component={SupplierTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="RequestDetail"
        component={RequestDetailScreen}
        options={{ title: 'Restock Request' }}
      />
    </Stack.Navigator>
  );
}
