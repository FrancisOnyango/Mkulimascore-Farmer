import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

export function ActionTile({ label, symbol, onPress }: { label: string; symbol: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, symbol.length > 1 && styles.wideIcon]}>
        <Text style={styles.symbol}>{symbol}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, minHeight: 104, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, justifyContent: 'space-between' },
  icon: { minWidth: 34, height: 30, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
  wideIcon: { backgroundColor: colors.infoSoft },
  symbol: { color: colors.brandDark, fontSize: 12, fontWeight: '900' },
  label: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: spacing.lg }
});
