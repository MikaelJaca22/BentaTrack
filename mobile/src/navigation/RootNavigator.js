import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext.js';
import LoginScreen from '../screens/auth/LoginScreen.js';
import CreateAccountScreen from '../screens/auth/CreateAccountScreen.js';
import OwnerNavigator from './OwnerNavigator.js';
import SupplierNavigator from './SupplierNavigator.js';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray100">
        <ActivityIndicator color="#000000" />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F5F5' } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      </Stack.Navigator>
    );
  }

  return user.role === 'store_owner' ? <OwnerNavigator /> : <SupplierNavigator />;
}
