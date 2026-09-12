import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/Card';
import { Body, Caption, H3 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import type { PlaceFilter, RankedPlace } from '@/domain/places';
import { PLACE_FILTER_LABELS, PLACE_FILTERS, PLACE_PIN_COLORS, isVerifiedPlace } from '@/domain/places';
import { OSM_ATTRIBUTION } from '@/lib/places/nearby';
import { colors, radius, spacing } from '@/constants/theme';

export function NearbyPlaces({
  places,
  filter,
  onFilter,
  farmId,
  compact = false
}: {
  places: RankedPlace[];
  filter?: PlaceFilter | null;
  onFilter?: (next: PlaceFilter | null) => void;
  farmId?: string;
  compact?: boolean;
}) {
  const shown = compact ? places.slice(0, 3) : places;
  return (
    <View>
      {onFilter ? (
        <View style={styles.filters}>
          <FilterChip label="All" active={!filter} onPress={() => onFilter(null)} />
          {PLACE_FILTERS.map((item) => (
            <FilterChip
              key={item}
              label={PLACE_FILTER_LABELS[item]}
              active={filter === item}
              onPress={() => onFilter(filter === item ? null : item)}
            />
          ))}
        </View>
      ) : null}

      {shown.length ? shown.map((place) => (
        <Card
          key={place.placeId}
          style={styles.card}
          accessibilityLabel={`${place.name}, ${place.distanceLabel}`}
          onPress={() => router.push({ pathname: '/places/[id]', params: { id: place.placeId, farmId } })}
        >
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: PLACE_PIN_COLORS[place.category] }]} />
            <View style={{ flex: 1 }}>
              <H3>{place.name}</H3>
              <Caption>{place.distanceLabel} from your farm{place.town ? ` · ${place.town}` : ''}</Caption>
              {place.recommendedLine ? <Body style={styles.recommend}>{place.recommendedLine}</Body> : null}
              <Caption style={{ marginTop: spacing.xs }}>
                {place.priceLabel ?? place.services.slice(0, 3).join(' · ') ?? place.commodities.slice(0, 3).join(' · ')}
              </Caption>
            </View>
          </View>
          <Caption style={{ marginTop: spacing.sm }}>
            {isVerifiedPlace(place.verification) ? '✓ Verified location' : place.verificationLabel}
            {place.freshnessLabel ? ` · ${place.freshnessLabel}` : ''}
          </Caption>
        </Card>
      )) : (
        <EmptyState
          title="No listed place in this filter"
          body="I will not invent an agrovet or buyer. Add the place you actually use."
          action="Add a place"
          onAction={() => router.push({ pathname: '/places/add', params: { farmId, category: filter === 'inputs' ? 'inputs' : filter === 'services' ? 'services' : 'markets' } })}
        />
      )}

      {compact && places.length > 3 ? (
        <Pressable
          onPress={() => router.push({ pathname: '/places', params: { farmId } })}
          accessibilityRole="button"
          accessibilityLabel="View all nearby places"
          style={styles.more}
        >
          <Text style={styles.moreText}>View all on list</Text>
        </Pressable>
      ) : null}

      <Caption style={styles.note}>{OSM_ATTRIBUTION} Distance is straight-line from the farm place.</Caption>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipOn]}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  card: { marginBottom: spacing.md, padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 7 },
  recommend: { marginTop: spacing.xs, color: colors.brand, fontWeight: '800' },
  more: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  moreText: { color: colors.info, fontWeight: '800' },
  note: { marginTop: spacing.sm, color: colors.faint }
});
