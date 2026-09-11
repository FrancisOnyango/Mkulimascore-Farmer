import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import type { Farm } from '@/domain/types';

export function LiveFarmMap({ farm }: { farm: Farm }) {
  const hasFarmCoordinate = Number.isFinite(farm.latitude) && Number.isFinite(farm.longitude);
  const hasBoundary = Boolean(farm.boundary && farm.boundary.length >= 3);
  const latitude = farm.latitude;
  const longitude = farm.longitude;

  async function openInMaps() {
    if (!hasFarmCoordinate || latitude == null || longitude == null) return;
    const label = encodeURIComponent(farm.name || 'Farm');
    const geoUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const canOpen = await Linking.canOpenURL(geoUrl);
    await Linking.openURL(canOpen ? geoUrl : webUrl);
  }

  return (
    <View style={styles.container} accessibilityLabel={`Farm location for ${farm.name}`}>
      <View style={styles.status}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>
          {hasFarmCoordinate ? (farm.mapped ? 'Saved farm location' : 'Approximate location') : 'Location unavailable'}
        </Text>
      </View>
      <Text style={styles.title}>{farm.name}</Text>
      <Text style={styles.detail}>
        {hasFarmCoordinate
          ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
          : 'This farm has no saved coordinates yet.'}
      </Text>
      <Text style={styles.detail}>
        {hasBoundary
          ? `${farm.measuredArea ?? 'Measured area pending'} ${farm.measuredArea ? farm.areaUnit : ''} measured / ${farm.reportedArea} ${farm.areaUnit} reported`
          : 'No boundary yet. A point or place name is enough for now.'}
      </Text>
      {hasFarmCoordinate ? (
        <Pressable onPress={() => void openInMaps()} style={styles.button} accessibilityRole="button" accessibilityLabel="Open farm location in maps">
          <Text style={styles.buttonText}>Open in Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 180, marginTop: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, padding: spacing.lg, justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  button: { alignSelf: 'flex-start', marginTop: spacing.md, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brandDark, justifyContent: 'center', paddingHorizontal: spacing.md },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '900' }
});
