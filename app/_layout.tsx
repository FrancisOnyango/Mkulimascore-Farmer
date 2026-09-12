import '@/lib/debug/bootstrap';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants/theme';

type StartupBoundaryState = { error: Error | null };

class StartupBoundary extends React.Component<React.PropsWithChildren, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.canvas }}>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Mkulima could not start</Text>
          <Text style={{ color: colors.muted }}>{this.state.error.message || 'Please restart the app.'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [Provider, setProvider] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      void import('@/context/AppDataContext')
        .then((module) => setProvider(() => module.AppDataProvider))
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  const stack = (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.canvas }
        }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="records/index" options={{ title: 'My records' }} />
          <Stack.Screen name="add/index" options={{ title: 'Add', presentation: 'modal' }} />
          <Stack.Screen name="add/production" options={{ title: 'Add production', presentation: 'modal' }} />
          <Stack.Screen name="add/sale" options={{ title: 'Add sale', presentation: 'modal' }} />
          <Stack.Screen name="add/cost" options={{ title: 'Add cost', presentation: 'modal' }} />
          <Stack.Screen name="add/record" options={{ title: 'Add record', presentation: 'modal' }} />
          <Stack.Screen name="add/correction" options={{ title: 'Request correction', presentation: 'modal' }} />
          <Stack.Screen name="farm/[id]" options={{ title: 'Farm' }} />
          <Stack.Screen name="farm/map" options={{ title: 'Farm place' }} />
          <Stack.Screen name="farm/compare" options={{ title: 'Compare markets' }} />
          <Stack.Screen name="enterprise/[id]" options={{ title: 'Enterprise' }} />
          <Stack.Screen name="request/[id]" options={{ title: 'Request' }} />
          <Stack.Screen name="records/[id]" options={{ title: 'Record' }} />
          <Stack.Screen name="insights/[kind]" options={{ title: 'Insights' }} />
          <Stack.Screen name="passport" options={{ title: 'Mkulima Passport' }} />
          <Stack.Screen name="ask" options={{ title: 'Ask Mkulima', headerShown: false }} />
          <Stack.Screen name="financing" options={{ title: 'Financing readiness' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="consents" options={{ title: 'My permissions' }} />
          <Stack.Screen name="connect-institution" options={{ title: 'Connect institution' }} />
          <Stack.Screen name="activity" options={{ title: 'Activity' }} />
          <Stack.Screen name="sync" options={{ title: 'Sync' }} />
        </Stack>
    </>
  );

  return (
    <StartupBoundary>
      {Provider ? <Provider>{stack}</Provider> : stack}
    </StartupBoundary>
  );
}
