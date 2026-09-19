import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '@/constants/theme';
import { useMobileLayout } from '@/hooks/useMobileLayout';

export function AuthShell({
  children,
  contentStyle,
  footer
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
}) {
  const { screenPad, short } = useMobileLayout();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, short && styles.contentShort, { paddingHorizontal: screenPad }, contentStyle]}>{children}</View>
        </ScrollView>
        {footer ? <View style={[styles.footer, { paddingHorizontal: screenPad }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingTop: spacing.md },
  contentShort: { paddingTop: spacing.xs },
  footer: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingBottom: spacing.md, gap: spacing.sm }
});
