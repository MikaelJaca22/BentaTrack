import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Bell, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext.js';
import client from '../api/client.js';

// Header shown at the top of tab screens (title, notifications, logout).
export default function TopHeader({ title, notificationsPath }) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    const load = () =>
      client
        .get('/notifications?unread=true&limit=1')
        .then((res) => {
          // unreadCount is a COUNT(*) over all unread rows, so it stays
          // accurate now that the list itself is paginated.
          if (active) setUnread(res.data.unreadCount);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isFocused, title]);

  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="bg-white border-b border-gray200 px-4 pb-3 flex-row items-center justify-between"
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-ink" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[11px] text-gray500" numberOfLines={1}>
          BentaTrack · {user?.name}
        </Text>
      </View>
      {notificationsPath ? (
        <Pressable
          onPress={() => navigation.navigate(notificationsPath)}
          className="p-2 rounded-lg active:bg-gray100 mr-1"
        >
          <Bell size={20} color="#0A0A0A" />
          {unread > 0 ? (
            <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black items-center justify-center">
              <Text className="text-white text-[9px]">{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      <Pressable onPress={logout} className="p-2 rounded-lg active:bg-gray100">
        <LogOut size={20} color="#0A0A0A" />
      </Pressable>
    </View>
  );
}
