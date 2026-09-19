import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark } from '@/components/BrandMark';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { ASK_UI, localizeAskText } from '@/lib/i18n/askLanguage';

export function AskBar({
  onPress,
  hint = 'A question about this farm'
}: {
  onPress: () => void;
  hint?: string;
}) {
  const language = useAppData().settings.language;
  const title = ASK_UI[language].title;
  const detail = localizeAskText(hint, language);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
    >
      <BrandMark size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.detail} numberOfLines={2}>{detail}</Text>
      </View>
      <View style={styles.send}>
        <Ionicons name="sparkles" size={15} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card
  },
  title: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  detail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDark
  }
});
