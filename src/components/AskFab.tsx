import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { colors, layout, shadow } from '@/constants/theme';
import { ASK_UI } from '@/lib/i18n/askLanguage';
import { useAppData } from '@/context/AppDataContext';
import { useMobileLayout } from '@/hooks/useMobileLayout';
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
  const { fabBottom, narrow, screenPad } = useMobileLayout();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/ask', params: { screen, farmId: farmId ?? '' } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { right: screenPad, bottom: fabBottom, maxWidth: narrow ? '72%' : undefined },
        pressed && { opacity: 0.9 }
      ]}
    >
      <BrandMark size={24} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    minHeight: layout.fabClearance - 16,
    borderRadius: 22,
    backgroundColor: colors.midnight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadow.card
  },
  label: { color: '#fff', fontSize: 13, fontWeight: '800', flexShrink: 1 }
});
