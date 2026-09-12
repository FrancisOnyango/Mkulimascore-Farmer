import React, { useMemo } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap } from '@/components/FarmPlaceMap';
import { useAppData } from '@/context/AppDataContext';
import { marketOpportunities } from '@/lib/markets/opportunity';
import { spacing } from '@/constants/theme';

export default function CompareMarkets() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { farms, enterprises, markets } = useAppData();
  const farm = farms.find((item) => item.id === farmId) ?? farms[0];
  const options = useMemo(
    () => marketOpportunities({ farm, enterprises, liveMarkets: markets, limit: 3 }),
    [farm, enterprises, markets]
  );

  if (!farm) {
    return <AppShell><Body>Add a farm place first.</Body></AppShell>;
  }

  return (
    <AppShell>
      <Eyebrow>Compare markets</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
      <Caption>From the farm place — not the phone. We do not invent a travel cost.</Caption>
      <FarmPlaceMap
        farm={farm}
        height={280}
        nearby={options.map((item) => ({
          name: `${item.name}${item.priceLabel ? ` · ${item.priceLabel}` : ''}`,
          latitude: item.latitude,
          longitude: item.longitude,
          distanceLabel: item.distanceLabel
        }))}
      />
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {options.map((item, index) => (
          <Card key={item.id}>
            <Caption>Option {index + 1}</Caption>
            <H3 style={{ marginTop: spacing.xs }}>{item.name}</H3>
            <Body style={{ marginTop: spacing.sm }}>{item.distanceLabel} · {item.town}</Body>
            <Body>{item.priceLabel ?? 'No reported price yet'}</Body>
            <Caption style={{ marginTop: spacing.sm }}>{item.freshnessLabel}</Caption>
            <View style={{ marginTop: spacing.md }}>
              <PrimaryButton
                label="Directions"
                variant="secondary"
                onPress={() => void Linking.openURL(`geo:${item.latitude},${item.longitude}?q=${item.latitude},${item.longitude}(${encodeURIComponent(item.name)})`)}
              />
            </View>
          </Card>
        ))}
      </View>
    </AppShell>
  );
}
