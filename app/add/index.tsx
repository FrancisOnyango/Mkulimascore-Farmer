import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Caption, H2, H3 } from '@/components/Typography';
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
      <H2 style={{ marginTop: spacing.xs }}>What happened?</H2>
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
      { title: 'Photo', detail: 'Take a picture or choose a file from this phone.', symbol: '•', route: '/add/record' },
      { title: 'Fix a detail', detail: 'Area, place or water.', symbol: '•', route: '/add/correction' },
      { title: 'Production', detail: 'Milk, harvest or flock.', symbol: '•', route: '/add/production' }
    ];
  }
  if (context === 'enterprise') {
    return [
      { title: 'Production', detail: 'Milk, harvest, eggs or delivery — with the date.', symbol: '•', route: '/add/production' },
      { title: 'Sale', detail: 'What you were paid, in Kenya shillings.', symbol: '•', route: '/add/sale' },
      { title: 'Cost', detail: 'Feed, seed, labour or transport.', symbol: '•', route: '/add/cost' },
      { title: 'Photo', detail: 'Take a picture or choose a file from this phone.', symbol: '•', route: '/add/record' }
    ];
  }
  if (context === 'records') {
    return [
      { title: 'Photo', detail: 'Take a picture or choose a file from this phone.', symbol: '•', route: '/add/record' },
      { title: 'Fix a detail', detail: 'Something looks wrong.', symbol: '•', route: '/add/correction' }
    ];
  }
  return [
    { title: 'Production', detail: 'Milk, harvest, eggs or delivery.', symbol: '•', route: '/add/production' },
    { title: 'Sale', detail: 'What you sold.', symbol: '•', route: '/add/sale' },
    { title: 'Cost', detail: 'Feed, seed or labour.', symbol: '•', route: '/add/cost' },
    { title: 'Photo', detail: 'Take a picture or choose a file from this phone.', symbol: '•', route: '/add/record' }
  ];
}

const styles = StyleSheet.create({
  shell: { paddingTop: spacing.xl },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.xl },
  options: { gap: spacing.md, marginTop: spacing.xl },
  option: { minHeight: 86, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  marker: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: colors.brandDark, fontWeight: '900', fontSize: 12 }
});
