import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { H3 } from './Typography';
import { colors, spacing } from '@/constants/theme';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <H3>{title}</H3>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${action} ${title}`}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
  action: { color: colors.info, fontWeight: '800', fontSize: 13 }
});
