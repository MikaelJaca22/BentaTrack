import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  MoreHorizontal,
} from 'lucide-react-native';

import DashboardScreen from '../screens/owner/DashboardScreen.js';
import NewSaleScreen from '../screens/owner/NewSaleScreen.js';
import ProductsScreen from '../screens/owner/ProductsScreen.js';
import RestockScreen from '../screens/owner/RestockScreen.js';
import MoreScreen from '../screens/owner/MoreScreen.js';
import ReceiptScreen from '../screens/owner/ReceiptScreen.js';
import RestockDetailScreen from '../screens/owner/RestockDetailScreen.js';
import SuppliersScreen from '../screens/owner/SuppliersScreen.js';
import ReportsScreen from '../screens/owner/ReportsScreen.js';
import NotificationsScreen from '../screens/owner/NotificationsScreen.js';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function OwnerTabs() {
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
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Sale"
        component={NewSaleScreen}
        options={{ tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Stock"
        component={ProductsScreen}
        options={{ tabBarIcon: ({ color }) => <Package size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Restock"
        component={RestockScreen}
        options={{ tabBarIcon: ({ color }) => <Truck size={22} color={color} /> }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function OwnerNavigator() {
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
      <Stack.Screen name="Tabs" component={OwnerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen
        name="RestockDetail"
        component={RestockDetailScreen}
        options={{ title: 'Restock Request' }}
      />
      <Stack.Screen name="Suppliers" component={SuppliersScreen} options={{ title: 'Suppliers' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}
