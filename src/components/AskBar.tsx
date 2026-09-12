import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

export function AskBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ask Mkulima"
      style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Ask Mkulima</Text>
        <Text style={styles.detail}>Weather, records, next step</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  detail: { color: colors.muted, fontSize: 13, marginTop: 2 }
});
