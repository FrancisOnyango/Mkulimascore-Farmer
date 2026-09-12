import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { colors, shadow, spacing } from '@/constants/theme';
import { ASK_UI } from '@/lib/i18n/askLanguage';
import { useAppData } from '@/context/AppDataContext';
import type { AskScreen } from '@/domain/ask';

export function AskFab({
  screen = 'ask',
  farmId
}: {
  screen?: AskScreen;
  farmId?: string;
}) {
  const language = useAppData().settings.language;
  const label = ASK_UI[language].title;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/ask', params: { screen, farmId: farmId ?? '' } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
    >
      <BrandMark size={28} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: 18,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadow.card
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800' }
});
