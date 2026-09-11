import type { OnboardingStep } from '@/domain/types';

export function routeForStep(step: OnboardingStep): '/onboarding/consent' | '/onboarding/identity' | '/onboarding/farm' | '/onboarding/enterprises' | '/onboarding/setup' | '/onboarding/institution' | '/onboarding/complete' | '/(tabs)/home' {
  if (step === 'identity') return '/onboarding/identity';
  if (step === 'farm') return '/onboarding/farm';
  if (step === 'enterprises') return '/onboarding/enterprises';
  if (step === 'enterprise_setup') return '/onboarding/setup';
  if (step === 'institution') return '/onboarding/institution';
  if (step === 'complete') return '/onboarding/complete';
  if (step === 'done') return '/(tabs)/home';
  return '/onboarding/consent';
}
