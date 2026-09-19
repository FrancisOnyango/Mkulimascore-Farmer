import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AskFab } from '@/components/AskFab';
import { colors, layout, radius, shadow, spacing } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import type { AskScreen } from '@/domain/ask';

export function AppShell({
  children,
  scroll = true,
  contentStyle,
  ask
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  ask?: { screen: AskScreen; farmId?: string };
}) {
  const { refreshing, refreshError, offline, lastUpdatedAt, lastSyncAt, refresh } = useAppData();
  const { screenPad, scrollBottom } = useMobileLayout();
  const padStyle = { paddingHorizontal: screenPad };
  const content = (
    <View style={[styles.content, padStyle, { paddingTop: spacing.md }, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottom(Boolean(ask)) }]}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} colors={[colors.brand]} />}
        >
          {refreshError ? (
            <Pressable onPress={() => void refresh()} style={[styles.errorBanner, padStyle]}>
              <Text style={styles.errorTitle}>We could not refresh your farm data</Text>
              <Text style={styles.errorAction}>Tap to try again</Text>
            </Pressable>
          ) : null}
          {offline ? (
            <Pressable onPress={() => void refresh()} style={[styles.offlineBanner, padStyle]} accessibilityRole="button">
              <Text style={styles.offlineTitle}>You are offline</Text>
              <Text style={styles.offlineText}>Showing what is saved on this phone. Tap to try again when you have a signal.</Text>
            </Pressable>
          ) : null}
          {lastUpdatedAt && !refreshing ? (
            <Text style={[styles.freshness, padStyle]}>
              Updated {lastUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {lastSyncAt ? ` · Synced` : ''}
            </Text>
          ) : null}
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {ask ? <AskFab screen={ask.screen} farmId={ask.farmId} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: colors.canvas },
  content: { flex: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  errorBanner: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.claySoft,
    borderWidth: 1,
    borderColor: '#DFC2C0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  errorTitle: { flex: 1, color: colors.clay, fontSize: 14, fontWeight: '800' },
  errorAction: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  offlineBanner: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warm,
    borderWidth: 1,
    borderColor: '#E8D0A8',
    ...shadow.card
  },
  offlineTitle: { color: colors.warmInk, fontSize: 15, fontWeight: '800' },
  offlineText: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 19 },
  freshness: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, fontWeight: '700' }
});
