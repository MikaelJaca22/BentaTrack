import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext.js';
import { extractError } from '../../api/client.js';
import { SYSTEM_TITLE } from '../../config.js';
import Button from '../../components/Button.js';
import Input from '../../components/Input.js';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      // RootNavigator switches automatically once user is set.
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="px-6 py-10">
          <View className="items-center mb-8">
            <Text className="text-2xl font-bold text-ink">BentaTrack</Text>
            <Text className="mt-1 text-xs text-gray500 text-center">{SYSTEM_TITLE}</Text>
          </View>

          <View className="bg-white border border-gray200 rounded-xl p-6">
            <Input
              label="Username"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Input
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? (
              <View className="flex-row items-center gap-1.5 mb-3">
                <AlertCircle size={16} color="#000000" />
                <Text className="text-sm font-medium text-black">{error}</Text>
              </View>
            ) : null}

            <Button onPress={onSubmit} disabled={busy} className="mb-2">
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>
            <Button variant="secondary" onPress={() => navigation.navigate('CreateAccount')}>
              Create Account
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
