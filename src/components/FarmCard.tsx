import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { colors, radius, spacing } from '@/constants/theme';
import { verificationShort } from '@/lib/copy/status';
import { formatFarmArea } from '@/lib/utils/format';
import type { Enterprise, Farm } from '@/domain/types';

export function FarmCard({
  farm,
  enterprises,
  seasonLabel,
  onPress
}: {
  farm: Farm;
  enterprises: Enterprise[];
  seasonLabel?: string;
  onPress?: () => void;
}) {
  const mapped = Boolean(farm.mapped && farm.boundary && farm.boundary.length >= 3);
  const placed = farm.latitude != null && farm.longitude != null;
  const badges = (enterprises.length ? enterprises.map((item) => item.sector) : farm.enterprises).slice(0, 4);
  const area = formatFarmArea(farm);

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/farm/${farm.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`Open ${farm.name}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      {placed ? (
        <FarmPlaceMap farm={farm} height={176} interactive={false} showZoom={false} basemap="satellite" />
      ) : (
        <View style={styles.emptyMap}>
          <Text style={styles.emptyTitle}>Farm place not marked yet</Text>
          <Text style={styles.emptyBody}>Use your location or drop a pin when you are there.</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{farm.name}</Text>
            <Text style={styles.place}>{farm.location || 'Location to be added'}</Text>
          </View>
          <Text style={styles.status}>{verificationShort(farm.verification)}</Text>
        </View>
        <Text style={styles.area}>{area}</Text>
        {badges.length ? <Text style={styles.badges}>{badges.join(' · ')}</Text> : null}
        {seasonLabel ? (
          <View style={styles.season}>
            <Text style={styles.seasonKicker}>Current season</Text>
            <Text style={styles.seasonText}>{seasonLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.cta}>
          {mapped ? 'Farmer mapped · View farm' : placed ? 'Map farm boundary' : 'Mark this farm place'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden'
  },
  emptyMap: {
    minHeight: 132,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    padding: spacing.xl
  },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  body: { padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  name: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  place: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  status: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  area: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: spacing.md },
  badges: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  season: { marginTop: spacing.md },
  seasonKicker: { color: colors.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  seasonText: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  cta: { color: colors.brandDark, fontSize: 14, fontWeight: '800', marginTop: spacing.md }
});
