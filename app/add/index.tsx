import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { colors, radius, spacing } from '@/constants/theme';

type AddContext = 'home' | 'farm' | 'enterprise' | 'records';

export default function AddHub() {
  const params = useLocalSearchParams<{ context?: string; farmId?: string; enterpriseId?: string }>();
  const context = normalizeContext(params.context);
  const options = optionsForContext(context);

  return (
    <AppShell contentStyle={styles.shell}>
      <View style={styles.sheetHandle} />
      <Caption>{labelForContext(context)}</Caption>
      <H2 style={{ marginTop: spacing.xs }}>Add activity</H2>
      <Body style={styles.lead}>Choose what happened. It is saved as added by you.</Body>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            key={option.route}
            accessibilityRole="button"
            accessibilityLabel={`Add ${option.title}`}
            onPress={() => router.replace({ pathname: option.route as never, params: { context, farmId: firstParam(params.farmId), enterpriseId: firstParam(params.enterpriseId) } })}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.86 }]}
          >
            <View style={styles.marker}><Text style={styles.markerText}>{option.symbol}</Text></View>
            <View style={{ flex: 1 }}>
              <H3>{option.title}</H3>
              <Caption style={{ marginTop: 3 }}>{option.detail}</Caption>
            </View>
          </Pressable>
        ))}
      </View>
    </AppShell>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeContext(value?: string | string[]): AddContext {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'farm' || raw === 'enterprise' || raw === 'records') return raw;
  return 'home';
}

function labelForContext(context: AddContext) {
  if (context === 'farm') return 'Farm update';
  if (context === 'enterprise') return 'Enterprise update';
  if (context === 'records') return 'My records';
  return 'Quick add';
}

function optionsForContext(context: AddContext) {
  if (context === 'farm') {
    return [
      { title: 'Farm evidence', detail: 'Photo, document or boundary support.', symbol: 'DOC', route: '/add/record' },
      { title: 'Report correction', detail: 'Update area, location, water or ownership for review.', symbol: 'FIX', route: '/add/correction' },
      { title: 'Add production', detail: 'Record output for a linked enterprise.', symbol: '+', route: '/add/production' }
    ];
  }
  if (context === 'enterprise') {
    return [
      { title: 'Production', detail: 'Today or this period output.', symbol: '+', route: '/add/production' },
      { title: 'Sale', detail: 'Price, buyer and quantity.', symbol: 'KES', route: '/add/sale' },
      { title: 'Cost', detail: 'Feed, input, labour or transport cost.', symbol: '-', route: '/add/cost' },
      { title: 'Document', detail: 'Statement, receipt or supporting document.', symbol: 'DOC', route: '/add/record' }
    ];
  }
  if (context === 'records') {
    return [
      { title: 'Upload document', detail: 'Statement, receipt, certificate or photo.', symbol: 'DOC', route: '/add/record' },
      { title: 'Report correction', detail: 'Tell Mkulima what looks incorrect.', symbol: 'FIX', route: '/add/correction' }
    ];
  }
  return [
    { title: 'Production', detail: 'Add the latest output for your enterprise.', symbol: '+', route: '/add/production' },
    { title: 'Sale', detail: 'Compare your realized price with market context.', symbol: 'KES', route: '/add/sale' },
    { title: 'Cost', detail: 'Unlock enterprise economics.', symbol: '-', route: '/add/cost' },
    { title: 'Document', detail: 'Strengthen your evidence vault.', symbol: 'DOC', route: '/add/record' }
  ];
}

const styles = StyleSheet.create({
  shell: { paddingTop: spacing.xl },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.xl },
  lead: { color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.xl },
  options: { gap: spacing.md },
  option: { minHeight: 86, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  marker: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: colors.brandDark, fontWeight: '900', fontSize: 12 }
});
