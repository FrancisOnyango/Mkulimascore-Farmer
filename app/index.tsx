import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { FarmerAppService } from '@/application/FarmerAppService';
import { routeForStep } from '@/lib/onboarding/routes';
import { colors } from '@/constants/theme';
import type { OnboardingStep } from '@/domain/types';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setTarget('/(auth)/welcome');
          return;
        }
        const session = await FarmerAppService.getSessionState();
        if (session.kind === 'self_onboarded' && session.step !== 'done') {
          setTarget(routeForStep(session.step as OnboardingStep));
          return;
        }
        setTarget('/(tabs)/home');
      } catch {
        setTarget('/(auth)/welcome');
      }
    })();
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return <Redirect href={target as never} />;
}
