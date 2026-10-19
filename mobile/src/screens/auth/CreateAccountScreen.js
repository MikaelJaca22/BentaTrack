import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext.js';
import { extractError } from '../../api/client.js';
import Button from '../../components/Button.js';
import Input from '../../components/Input.js';
import { SYSTEM_TITLE } from '../../config.js';

export default function CreateAccountScreen({ navigation }) {
  const { register } = useAuth();
  const [role, setRole] = useState('store_owner');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);

  function clientValidate() {
    const fe = {};
    if (!name.trim()) fe.name = 'Name is required';
    if (!/^[A-Za-z0-9_.]{4,20}$/.test(username))
      fe.username = 'Username must be 4-20 chars: letters, numbers, underscore, period';
    if (password.length < 8) fe.password = 'Password must be at least 8 characters';
    if (password !== confirm) fe.confirm = 'Passwords do not match';
    setFieldErr(fe);
    return Object.keys(fe).length === 0;
  }

  async function onSubmit() {
    setError('');
    if (!clientValidate()) return;
    setBusy(true);
    try {
      await register({ role, name, username, password });
    } catch (err) {
      const { message, field } = extractError(err);
      setError(message);
      if (field) setFieldErr((p) => ({ ...p, [field]: message }));
    } finally {
      setBusy(false);
    }
  }

  const nameLabel = role === 'store_owner' ? 'Store Owner Name' : 'Supplier Name';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6">
          <Text className="text-lg font-bold text-ink">Create Account</Text>
          <Text className="mt-1 text-xs text-gray500">{SYSTEM_TITLE}</Text>
        </View>

        <View className="bg-white border border-gray200 rounded-xl p-5">
          <Text className="mb-1.5 text-sm font-medium text-ink">Account Type</Text>
          <View className="flex-row gap-2 mb-4">
            {[
              { v: 'store_owner', l: 'Store Owner' },
              { v: 'supplier', l: 'Supplier' },
            ].map((opt) => (
              <Pressable
                key={opt.v}
                onPress={() => setRole(opt.v)}
                className={`flex-1 rounded-xl py-3 items-center border ${
                  role === opt.v ? 'bg-black border-black' : 'bg-white border-gray300'
                }`}
              >
                <Text className={`text-sm font-medium ${role === opt.v ? 'text-white' : 'text-black'}`}>
                  {opt.l}
                </Text>
              </Pressable>
            ))}
          </View>

          <Input label={nameLabel} value={name} onChangeText={setName} error={fieldErr.name} />
          <Input
            label="Username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            error={fieldErr.username}
          />
          <Input
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={fieldErr.password}
          />
          <Input
            label="Confirm Password"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            error={fieldErr.confirm}
          />

          {error ? (
            <View className="flex-row items-center gap-1.5 mb-3">
              <AlertCircle size={16} color="#000000" />
              <Text className="text-sm font-medium text-black">{error}</Text>
            </View>
          ) : null}

          <Button onPress={onSubmit} disabled={busy} className="mb-2">
            {busy ? 'Creating…' : 'Create Account'}
          </Button>
          <Button variant="secondary" onPress={() => navigation.goBack()}>
            Back to Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
