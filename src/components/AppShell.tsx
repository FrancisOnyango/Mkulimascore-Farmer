import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';

export function AppShell({
  children,
  scroll = true,
  contentStyle
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const { refreshing, refreshError, offline, lastUpdatedAt, lastSyncAt, refresh } = useAppData();
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} colors={[colors.brand]} />}
        >
          {refreshError ? (
            <Pressable onPress={() => void refresh()} style={styles.errorBanner}>
              <Text style={styles.errorTitle}>We could not refresh your farm data</Text>
              <Text style={styles.errorAction}>Tap to try again</Text>
            </Pressable>
          ) : null}
          {offline ? (
            <Pressable onPress={() => void refresh()} style={styles.offlineBanner} accessibilityRole="button">
              <Text style={styles.offlineTitle}>You are offline</Text>
              <Text style={styles.offlineText}>Showing what is saved on this phone. Tap to try again when you have a signal.</Text>
            </Pressable>
          ) : null}
          {lastUpdatedAt && !refreshing ? (
            <Text style={styles.freshness}>
              Updated {lastUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {lastSyncAt ? ` · Synced` : ''}
            </Text>
          ) : null}
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 128 },
  content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  errorBanner: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.claySoft, borderWidth: 1, borderColor: '#E7C8BF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  errorTitle: { flex: 1, color: colors.clay, fontSize: 14, fontWeight: '800' },
  errorAction: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  offlineBanner: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warm, borderWidth: 1, borderColor: '#E7D7AE' },
  offlineTitle: { color: colors.warmInk, fontSize: 15, fontWeight: '800' },
  offlineText: { color: colors.muted, fontSize: 14, marginTop: 2, lineHeight: 20 },
  freshness: { marginHorizontal: spacing.xl, marginTop: spacing.sm, color: colors.muted, fontSize: 13, fontWeight: '700' }
});
