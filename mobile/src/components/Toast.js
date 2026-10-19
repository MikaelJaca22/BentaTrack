import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message) => {
    const id = nextId++;
    setMsg({ id, message });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);

  const toast = {
    success: (m) => show(m),
    error: (m) => show(m),
    info: (m) => show(m),
  };

  return (
    <ToastContext.Provider value={toast}>
      <View className="flex-1">
        {children}
        {msg ? (
          <View
            pointerEvents="none"
            className="absolute left-4 right-4 bottom-24 bg-black rounded-xl px-4 py-3"
          >
            <Text className="text-white text-sm">{msg.message}</Text>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
