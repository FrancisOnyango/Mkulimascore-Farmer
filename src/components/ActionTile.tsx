import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

export function ActionTile({
  icon,
  label,
  onPress,
  tone = 'light'
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'light' | 'dark' | 'soft';
}) {
  const dark = tone === 'dark';
  const soft = tone === 'soft';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        dark && styles.dark,
        soft && styles.soft,
        pressed && { opacity: 0.88 }
      ]}
    >
      <View style={[styles.iconWrap, dark && styles.iconWrapDark]}>
        <Ionicons name={icon} size={22} color={dark ? '#fff' : colors.brandDark} />
      </View>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  dark: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  soft: { backgroundColor: colors.brandSoft, borderColor: '#C9E0D1' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  labelDark: { color: '#fff' }
});
