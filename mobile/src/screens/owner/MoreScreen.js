import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, BarChart3, Bell, LogOut, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext.js';
import TopHeader from '../../components/TopHeader.js';

export default function MoreScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const items = [
    { label: 'Suppliers', icon: Users, to: 'Suppliers' },
    { label: 'Reports', icon: BarChart3, to: 'Reports' },
    { label: 'Notifications', icon: Bell, to: 'Notifications' },
  ];

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="More" notificationsPath="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white border border-gray200 rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-ink">{user?.name}</Text>
          <Text className="text-xs text-gray500">@{user?.username} · Store Owner</Text>
        </View>

        <View className="bg-white border border-gray200 rounded-xl overflow-hidden mb-4">
          {items.map((it, i) => (
            <Pressable
              key={it.to}
              onPress={() => navigation.navigate(it.to)}
              className={`flex-row items-center gap-3 px-4 py-4 active:bg-gray100 ${
                i > 0 ? 'border-t border-gray200' : ''
              }`}
            >
              <it.icon size={18} color="#0A0A0A" />
              <Text className="flex-1 text-sm font-medium text-ink">{it.label}</Text>
              <ChevronRight size={18} color="#A3A3A3" />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={logout}
          className="flex-row items-center justify-center gap-2 bg-white border border-black rounded-xl px-4 py-4 active:bg-gray100"
        >
          <LogOut size={18} color="#000000" />
          <Text className="text-sm font-medium text-black">Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
