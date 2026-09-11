import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, H3 } from './Typography';
import { colors, radius, spacing } from '@/constants/theme';

export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.box}>
      <H3>{title}</H3>
      <Body style={styles.body}>{body}</Body>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, padding: spacing.xl, backgroundColor: colors.surface },
  body: { marginTop: spacing.sm, color: colors.muted },
  action: { alignSelf: 'flex-start', marginTop: spacing.lg, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.brandDark, justifyContent: 'center', paddingHorizontal: spacing.lg },
  actionText: { color: '#fff', fontWeight: '900' }
});
