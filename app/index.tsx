import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { colors } from '@/constants/theme';
import type { OnboardingStep } from '@/domain/types';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const [{ getAccessToken }, { FarmerAppService }, { routeForStep }] = await Promise.all([
            import('@/lib/auth/tokenStore'),
            import('@/application/FarmerAppService'),
            import('@/lib/onboarding/routes')
          ]);
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
    }, 50);
    return () => clearTimeout(handle);
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas, gap: 16 }}>
        <BrandMark size={72} />
        <Text style={{ color: colors.brandDark, fontSize: 28, fontWeight: '800' }}>Mkulima</Text>
      </View>
    );
  }
  return <Redirect href={target as never} />;
}
