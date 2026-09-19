import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

type Tone = 'good' | 'attention' | 'neutral' | 'verified' | 'danger';

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const palette = {
    good: { bg: colors.accentSoft, fg: colors.brandDark },
    verified: { bg: '#E8F3ED', fg: colors.success },
    attention: { bg: colors.warm, fg: colors.warmInk },
    neutral: { bg: colors.surfaceAlt, fg: colors.muted },
    danger: { bg: colors.claySoft, fg: colors.danger }
  }[tone];

  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.fg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1 },
  text: { fontSize: 12, fontWeight: '800' }
});
