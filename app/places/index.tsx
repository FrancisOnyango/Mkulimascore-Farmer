import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H1 } from '@/components/Typography';
import { AskBar } from '@/components/AskBar';
import { NearbyPlaces } from '@/components/NearbyPlaces';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/context/AppDataContext';
import { listFarmerPlaces } from '@/db/database';
import type { AgriculturalPlace, PlaceFilter, RankedPlace } from '@/domain/places';
import { PLACE_PIN_COLORS } from '@/domain/places';
import { farmOrigin } from '@/lib/markets/linkage';
import { DEFAULT_PLACE_RADIUS_KM, fetchNearbyPlaces, listNearbyPlaces } from '@/lib/places/nearby';
import { colors, spacing } from '@/constants/theme';

export default function NearbyPlacesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { farms, enterprises, markets, ready } = useAppData();
  const farm = farms.find((item) => item.id === farmId) ?? farms[0];
  const farmEnterprises = enterprises.filter((item) => !farm || item.farmId === farm.id);
  const [filter, setFilter] = useState<PlaceFilter | null>(null);
  const [extras, setExtras] = useState<AgriculturalPlace[]>([]);
  const origin = farm ? farmOrigin(farm) : null;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void (async () => {
      const local = await listFarmerPlaces();
      const remote = origin
        ? await fetchNearbyPlaces({
          latitude: origin.latitude,
          longitude: origin.longitude,
          commodity: farmEnterprises[0]?.sector,
          category: filter,
          radiusKm: DEFAULT_PLACE_RADIUS_KM
        })
        : [];
      if (alive) setExtras([...local, ...remote]);
    })();
    return () => { alive = false; };
  }, [farm?.id, filter, origin?.latitude, origin?.longitude, farmEnterprises[0]?.sector, ready]);

  const places = useMemo(
    () => listNearbyPlaces({ farm, enterprises: farmEnterprises, liveMarkets: markets, extras, filter }),
    [enterpriseKey(farmEnterprises), extras, farm, filter, markets]
  );

  return (
    <AppShell>
      <H1>Near your farm</H1>
      <Body style={styles.lead}>
        Ranked for {farmEnterprises[0]?.sector ? `your ${farmEnterprises[0].sector.toLowerCase()}` : 'this farm'} — not only the nearest pin.
      </Body>
      <View style={{ marginTop: spacing.lg }}>
        <AskBar
          hint="Where can I sell or buy near this farm?"
          onPress={() => router.push({ pathname: '/ask', params: { screen: 'places', farmId: farm?.id ?? '' } })}
        />
      </View>
      {!farm || !origin ? (
        <Caption style={{ marginTop: spacing.lg }}>Mark the farm place first. Nearby is from the farm, not the phone.</Caption>
      ) : (
        <>
          <View style={{ marginTop: spacing.lg }}>
            <FarmPlaceMap farm={farm} nearby={toPins(places)} height={200} />
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <NearbyPlaces places={places} filter={filter} onFilter={setFilter} farmId={farm?.id} />
          </View>
        </>
      )}
      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Add a place you use" onPress={() => router.push({ pathname: '/places/add', params: { farmId: farm?.id } })} />
      </View>
    </AppShell>
  );
}

function toPins(places: RankedPlace[]) {
  return places.slice(0, 12).map((place) => ({
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceLabel: place.distanceLabel,
    color: PLACE_PIN_COLORS[place.category]
  }));
}

function enterpriseKey(enterprises: { id: string }[]) {
  return enterprises.map((item) => item.id).join(',');
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm }
});
