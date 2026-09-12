import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { useAppData } from '@/context/AppDataContext';
import { listFarmerPlaces } from '@/db/database';
import type { AgriculturalPlace } from '@/domain/places';
import { PLACE_CATEGORY_LABELS, PLACE_PIN_COLORS, isVerifiedPlace, verificationLabel } from '@/domain/places';
import { farmOrigin } from '@/lib/markets/linkage';
import { findPlace, listNearbyPlaces } from '@/lib/places/nearby';
import { colors, spacing } from '@/constants/theme';

export default function PlaceDetail() {
  const { id, farmId } = useLocalSearchParams<{ id: string; farmId?: string }>();
  const { farms, enterprises, markets, ready } = useAppData();
  const farm = farms.find((item) => item.id === farmId) ?? farms[0];
  const [extras, setExtras] = useState<AgriculturalPlace[]>([]);

  useEffect(() => {
    if (!ready) return;
    void listFarmerPlaces().then(setExtras);
  }, [ready]);

  const ranked = useMemo(() => {
    const nearby = listNearbyPlaces({
      farm,
      enterprises: enterprises.filter((item) => !farm || item.farmId === farm.id),
      liveMarkets: markets,
      extras,
      limit: 40
    });
    return nearby.find((item) => item.placeId === id) ?? null;
  }, [enterprises, extras, farm, id, markets]);

  const place = ranked ?? findPlace(id ?? '', extras);
  if (!place) {
    return (
      <AppShell>
        <H2>Place not found</H2>
        <Body style={{ marginTop: spacing.md }}>This listing is not on this phone.</Body>
      </AppShell>
    );
  }

  const origin = farm ? farmOrigin(farm) : null;
  const kmLabel = ranked?.distanceLabel ?? (origin ? 'From your farm' : 'Farm place not set');
  const verified = isVerifiedPlace(place.verification);
  const geo = `geo:${place.latitude},${place.longitude}?q=${encodeURIComponent(place.name)}`;

  return (
    <AppShell>
      <Caption>{PLACE_CATEGORY_LABELS[place.category]}</Caption>
      <H2 style={{ marginTop: spacing.xs }}>{place.name}</H2>
      <Caption>{[place.town, place.county].filter(Boolean).join(', ')}</Caption>
      <View style={styles.pills}>
        <StatusPill label={kmLabel} tone="neutral" />
        <StatusPill label={verified ? 'Verified location' : verificationLabel(place.verification)} tone={verified ? 'verified' : 'neutral'} />
      </View>
      {ranked?.recommendedLine ? <Body style={styles.recommend}>{ranked.recommendedLine}</Body> : null}

      {farm ? (
        <View style={{ marginTop: spacing.lg }}>
          <FarmPlaceMap
            farm={farm}
            height={200}
            nearby={[{
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude,
              distanceLabel: ranked?.distanceLabel,
              color: PLACE_PIN_COLORS[place.category]
            }]}
          />
        </View>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <H3>What we know</H3>
        {place.services.length ? <Body style={styles.block}>{place.services.join(' · ')}</Body> : null}
        {place.commodities.length ? <Caption style={styles.block}>Relevant products: {place.commodities.join(', ')}</Caption> : null}
        {ranked?.priceLabel ? (
          <>
            <Body style={styles.block}>Latest reported: {ranked.priceLabel}</Body>
            <Caption>{ranked.freshnessLabel ?? 'Latest reported'} · Source: KAMIS. Not a live shop offer.</Caption>
          </>
        ) : place.category === 'inputs' ? (
          <Caption style={styles.block}>No Ministry fertilizer or seed quote for this shop. Confirm the bag price there.</Caption>
        ) : null}
        {place.phone ? <Body style={styles.block}>Phone {place.phone}</Body> : null}
        {place.openingHours ? <Caption>Hours: {place.openingHours}</Caption> : null}
        <Caption style={styles.block}>{verificationLabel(place.verification)}. Distance is straight-line, not by road.</Caption>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton label="Directions" variant="secondary" onPress={() => void Linking.openURL(geo)} />
        {place.phone ? <PrimaryButton label="Call" onPress={() => void Linking.openURL(`tel:${place.phone}`)} /> : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  recommend: { marginTop: spacing.md, color: colors.brand, fontWeight: '800' },
  block: { marginTop: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md }
});
