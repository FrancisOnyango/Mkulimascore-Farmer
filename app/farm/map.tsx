import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap, type MapPoint, type MapStudioMode } from '@/components/FarmPlaceMap';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { getDeviceFix, watchDeviceFixes } from '@/lib/geo/deviceLocation';
import { GPS_AREA_ACCURACY_M, pathMetres } from '@/lib/geo/geo';
import type { Farm } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';

type Method = 'walk' | 'draw' | 'verify';

export default function FarmMapStudio() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { farms, refresh } = useAppData();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [basemap, setBasemap] = useState<'map' | 'satellite'>('satellite');
  const [draftPoint, setDraftPoint] = useState<MapPoint | null>(null);
  const [draftShape, setDraftShape] = useState<MapPoint[]>([]);
  const [walkPoint, setWalkPoint] = useState<MapPoint | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [session, setSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopWalk = useRef<(() => void) | null>(null);

  useEffect(() => {
    const id = farmId || farms[0]?.id;
    if (!id) return;
    void FarmerAppService.getFarm(id).then(setFarm);
    return () => { stopWalk.current?.(); };
  }, [farmId, farms]);

  const mode: MapStudioMode = method === 'walk' ? 'walk' : method === 'draw' ? 'draw' : 'view';
  const walkedM = pathMetres(draftShape);

  function resetDraft() {
    stopWalk.current?.();
    stopWalk.current = null;
    setWalking(false);
    setDraftPoint(null);
    setDraftShape([]);
    setWalkPoint(null);
    setAccuracyM(null);
    setSession((value) => value + 1);
    setNote(null);
    setError(null);
  }

  async function useGpsPoint() {
    setError(null);
    const result = await getDeviceFix();
    if (!result.ok) {
      setError(result.reason === 'denied'
        ? 'Location permission is needed only to mark this farm.'
        : 'GPS is not available on this phone yet. Draw the place or reinstall the latest app.');
      return;
    }
    setDraftPoint(result.fix);
    setAccuracyM(result.fix.accuracy);
    setNote(result.fix.accuracy > GPS_AREA_ACCURACY_M
      ? `GPS is about ${Math.round(result.fix.accuracy)} m wide. We will save the point, not acres.`
      : `GPS found you within ${Math.round(result.fix.accuracy)} m.`);
    if (!farm) return;
    await FarmerAppService.saveFarmPlace({
      farmId: farm.id,
      kind: 'point',
      latitude: result.fix.latitude,
      longitude: result.fix.longitude,
      accuracyM: result.fix.accuracy
    });
    await refresh();
    const next = await FarmerAppService.getFarm(farm.id);
    if (next) setFarm(next);
  }

  async function startWalk() {
    setError(null);
    resetDraft();
    setMethod('walk');
    const watch = await watchDeviceFixes((fix) => {
      const point = { latitude: fix.latitude, longitude: fix.longitude };
      setWalkPoint(point);
      setDraftShape((current) => [...current, point]);
      setAccuracyM((current) => current == null ? fix.accuracy : Math.max(current, fix.accuracy));
    });
    if ('ok' in watch && watch.ok === false) {
      setError(watch.reason === 'denied'
        ? 'Location permission is needed to walk the edge.'
        : 'GPS is not available. Draw the edge instead.');
      return;
    }
    if (!('stop' in watch)) return;
    stopWalk.current = watch.stop;
    setWalking(true);
    setNote('Walk the edge slowly. Finish when you return to the start.');
  }

  async function saveShape() {
    if (!farm) return;
    if (draftShape.length < 3) {
      setError('Add at least three points around the farm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await FarmerAppService.saveFarmPlace({
        farmId: farm.id,
        kind: 'polygon',
        latitude: draftShape[0]?.latitude ?? farm.latitude ?? 0,
        longitude: draftShape[0]?.longitude ?? farm.longitude ?? 0,
        boundary: draftShape,
        boundarySource: method === 'walk' ? 'GPS_WALK' : 'DRAWN',
        accuracyM
      });
      await refresh();
      router.back();
    } catch {
      setError('Could not save this farm place. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function askVisit() {
    if (!farm) return;
    setBusy(true);
    try {
      await FarmerAppService.requestBoundaryVerification(farm.id);
      await refresh();
      router.back();
    } catch {
      setError('Could not save the visit request.');
    } finally {
      setBusy(false);
    }
  }

  if (!farm) {
    return <AppShell><Body>Loading farm place...</Body></AppShell>;
  }

  if (!method) {
    return (
      <AppShell>
        <Eyebrow>Map my farm</Eyebrow>
        <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
        <Caption>A point is enough to start. A shape confirms the cultivated area later.</Caption>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Choice title="Walk the boundary" detail="Best when you are on the farm" onPress={() => void startWalk()} />
          <Choice title="Draw on map" detail="Quick when you can see the land" onPress={() => setMethod('draw')} />
          <Choice title="Ask for verification" detail="A field officer can confirm later. Kept as added by you until then." onPress={() => void askVisit()} />
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Use GPS for a point only" variant="secondary" onPress={() => void useGpsPoint()} />
        </View>
        {error ? <Caption style={styles.error}>{error}</Caption> : null}
        {note ? <Caption style={{ marginTop: spacing.sm }}>{note}</Caption> : null}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Eyebrow>Farm place</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
      <Caption>{method === 'walk' ? 'Walk the edge. Poor GPS will not invent acres.' : 'Tap around the edge. Added by you until a visit confirms it.'}</Caption>

      <View style={styles.modes}>
        <Pressable onPress={() => setBasemap('satellite')} style={[styles.mode, basemap === 'satellite' && styles.modeOn]}>
          <Text style={[styles.modeText, basemap === 'satellite' && styles.modeTextOn]}>Satellite</Text>
        </Pressable>
        <Pressable onPress={() => setBasemap('map')} style={[styles.mode, basemap === 'map' && styles.modeOn]}>
          <Text style={[styles.modeText, basemap === 'map' && styles.modeTextOn]}>Map</Text>
        </Pressable>
        <Pressable onPress={() => { resetDraft(); setMethod(null); }} style={styles.mode}>
          <Text style={styles.modeText}>Back</Text>
        </Pressable>
      </View>

      <FarmPlaceMap
        farm={farm}
        mode={mode}
        height={320}
        session={session}
        walkPoint={walkPoint}
        basemap={basemap}
        onPoint={setDraftPoint}
        onPolygon={setDraftShape}
      />

      {method === 'walk' ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3>Boundary capture</H3>
          <Body style={{ marginTop: spacing.sm }}>GPS accuracy · {accuracyM != null ? `${Math.round(accuracyM)} m` : 'waiting'}</Body>
          <Body>Points captured · {draftShape.length}</Body>
          <Body>Distance walked · {walkedM} m</Body>
          {note ? <Caption style={{ marginTop: spacing.sm }}>{note}</Caption> : null}
          {error ? <Caption style={styles.error}>{error}</Caption> : null}
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <PrimaryButton
              label={walking ? 'Finish boundary' : 'Walk the edge'}
              onPress={() => {
                if (walking) {
                  stopWalk.current?.();
                  stopWalk.current = null;
                  setWalking(false);
                  if (draftShape.length >= 3) void saveShape();
                  else setNote('Keep walking until three points appear.');
                } else {
                  void startWalk();
                }
              }}
            />
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.md }}>
          <Body>Tap the map around the farm. {draftShape.length} points so far.</Body>
          {draftPoint ? <Caption style={{ marginTop: spacing.sm }}>Last tap saved on this phone.</Caption> : null}
          {error ? <Caption style={styles.error}>{error}</Caption> : null}
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label={busy ? 'Saving...' : 'Save boundary'} disabled={busy} onPress={() => void saveShape()} />
          </View>
        </Card>
      )}
    </AppShell>
  );
}

function Choice({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.choice} accessibilityRole="button" accessibilityLabel={title}>
      <H3>{title}</H3>
      <Caption style={{ marginTop: 4 }}>{detail}</Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  mode: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  modeText: { color: colors.muted, fontWeight: '800' },
  modeTextOn: { color: '#fff' },
  error: { marginTop: spacing.sm, color: colors.danger, fontWeight: '700' },
  choice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg }
});
