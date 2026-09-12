import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmPlaceMap, type MapPoint, type MapStudioMode } from '@/components/FarmPlaceMap';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { getDeviceFix, watchDeviceFixes } from '@/lib/geo/deviceLocation';
import { GPS_AREA_ACCURACY_M } from '@/lib/geo/geo';
import { closeWalkRing, shouldKeepWalkFix, walkStats, type WalkFix } from '@/lib/geo/walk';
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
  const [path, setPath] = useState<WalkFix[]>([]);
  const [drawShape, setDrawShape] = useState<MapPoint[]>([]);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopWalk = useRef<(() => void) | null>(null);
  const pathRef = useRef<WalkFix[]>([]);

  useEffect(() => {
    const id = farmId || farms[0]?.id;
    if (!id) return;
    void FarmerAppService.getFarm(id).then(setFarm);
    return () => { stopWalk.current?.(); };
  }, [farmId, farms]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const mode: MapStudioMode = method === 'walk' ? 'walk' : method === 'draw' ? 'draw' : 'view';
  const stats = useMemo(() => walkStats(path), [path]);
  const livePath = method === 'walk' ? path : drawShape;

  function clearPath() {
    stopWalk.current?.();
    stopWalk.current = null;
    setWalking(false);
    setPaused(false);
    setPath([]);
    pathRef.current = [];
    setDrawShape([]);
    setDraftPoint(null);
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

  function onWalkFix(fix: WalkFix) {
    setAccuracyM(fix.accuracy);
    const verdict = shouldKeepWalkFix(pathRef.current, fix);
    if (!verdict.keep) {
      if (verdict.reason === 'wide') setNote('GPS is still wide. Stand still until the number drops, then walk slowly.');
      return;
    }
    const next = [...pathRef.current, fix];
    pathRef.current = next;
    setPath(next);
    const nextStats = walkStats(next);
    if (nextStats.canClose) setNote('You are back near the start. You can close this boundary.');
    else if (next.length === 1) setNote('Start recorded. Walk the edge slowly and stay on the cultivated side.');
    else setNote(`Keep walking the edge. ${nextStats.metres} m so far.`);
  }

  async function startWalk() {
    setError(null);
    setMethod('walk');
    setPaused(false);
    setNote('Finding your place on the farm...');
    if (!pathRef.current.length) {
      const first = await getDeviceFix();
      if (first.ok) {
        const seed = shouldKeepWalkFix([], first.fix);
        setAccuracyM(first.fix.accuracy);
        if (seed.keep) {
          pathRef.current = [first.fix];
          setPath([first.fix]);
          setNote('Start recorded. Walk the edge slowly.');
        } else {
          setNote('GPS is wide. Stand at a corner until it tightens, then walk.');
        }
      }
    }
    const watch = await watchDeviceFixes((fix) => onWalkFix(fix));
    if ('ok' in watch && watch.ok === false) {
      setError(watch.reason === 'denied'
        ? 'Location permission is needed to walk the edge.'
        : 'GPS is not available. Draw the edge instead.');
      return;
    }
    if (!('stop' in watch)) return;
    stopWalk.current = watch.stop;
    setWalking(true);
  }

  function pauseWalk() {
    stopWalk.current?.();
    stopWalk.current = null;
    setWalking(false);
    setPaused(true);
    setNote('Walking paused. The shape stays on this phone.');
  }

  async function resumeWalk() {
    setPaused(false);
    const watch = await watchDeviceFixes((fix) => onWalkFix(fix));
    if ('ok' in watch && watch.ok === false) {
      setError('Could not resume GPS.');
      return;
    }
    if (!('stop' in watch)) return;
    stopWalk.current = watch.stop;
    setWalking(true);
    setNote('Walking again. Stay on the edge.');
  }

  function undoPoint() {
    setPath((current) => {
      const next = current.slice(0, -1);
      pathRef.current = next;
      return next;
    });
  }

  async function saveShape(source: 'GPS_WALK' | 'DRAWN', points: MapPoint[], accuracy?: number | null) {
    if (!farm) return;
    if (points.length < 3) {
      setError('Add at least three points around the farm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await FarmerAppService.saveFarmPlace({
        farmId: farm.id,
        kind: 'polygon',
        latitude: points[0]?.latitude ?? farm.latitude ?? 0,
        longitude: points[0]?.longitude ?? farm.longitude ?? 0,
        boundary: points,
        boundarySource: source,
        accuracyM: accuracy
      });
      await refresh();
      router.back();
    } catch {
      setError('Could not save this farm place. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function finishWalk() {
    stopWalk.current?.();
    stopWalk.current = null;
    setWalking(false);
    if (!stats.canSave) {
      setNote('Keep walking until at least three good points appear.');
      return;
    }
    const closed = closeWalkRing(path);
    const closing = walkStats(closed);
    const acresLine = closing.acres != null
      ? `About ${closing.acres} acres if this GPS holds.`
      : 'GPS is too wide to measure acres. The shape will still be saved.';
    Alert.alert(
      stats.canClose ? 'Close this boundary?' : 'Save this walk?',
      stats.canClose
        ? `You returned near the start after ${stats.metres} m. ${acresLine}`
        : `The walk has not returned to the start (${stats.gapM ?? '—'} m away). ${acresLine}`,
      [
        { text: 'Keep walking', style: 'cancel', onPress: () => void resumeWalk() },
        { text: 'Save shape', onPress: () => void saveShape('GPS_WALK', closed, closing.medianAccuracy) }
      ]
    );
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
        <Caption>A point is enough to start. Walking the edge is the strongest shape you can add yourself.</Caption>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Choice title="Walk the boundary" detail="Stand at a corner, then walk the cultivated edge slowly" onPress={() => void startWalk()} />
          <Choice title="Draw on map" detail="Pinch to zoom, then tap around the land" onPress={() => setMethod('draw')} />
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

  const accuracyTone = accuracyM == null ? 'Waiting' : accuracyM <= 15 ? 'Tight GPS' : accuracyM <= 25 ? 'Usable GPS' : 'Wide GPS';

  return (
    <AppShell scroll={false} contentStyle={styles.studio}>
      <Eyebrow>Farm place</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{farm.name}</H2>
      <Caption>
        {method === 'walk'
          ? 'Pinch or use + − to zoom. Walk the cultivated edge. Poor GPS will not invent acres.'
          : 'Pinch or use + − to zoom, then tap around the edge.'}
      </Caption>

      <View style={styles.modes}>
        <Pressable onPress={() => setBasemap('satellite')} style={[styles.mode, basemap === 'satellite' && styles.modeOn]}>
          <Text style={[styles.modeText, basemap === 'satellite' && styles.modeTextOn]}>Satellite</Text>
        </Pressable>
        <Pressable onPress={() => setBasemap('map')} style={[styles.mode, basemap === 'map' && styles.modeOn]}>
          <Text style={[styles.modeText, basemap === 'map' && styles.modeTextOn]}>Map</Text>
        </Pressable>
        <Pressable onPress={() => { clearPath(); setMethod(null); }} style={styles.mode}>
          <Text style={styles.modeText}>Back</Text>
        </Pressable>
      </View>

      <FarmPlaceMap
        farm={farm}
        mode={mode}
        height={340}
        session={session}
        path={livePath}
        follow={method === 'walk' && walking}
        basemap={basemap}
        onPoint={setDraftPoint}
        onPolygon={setDrawShape}
      />

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
      {method === 'walk' ? (
        <Card style={styles.panel}>
          <View style={styles.hud}>
            <Hud label={accuracyTone} value={accuracyM != null ? `${Math.round(accuracyM)} m` : '—'} tone={accuracyM != null && accuracyM <= 25 ? 'good' : 'wait'} />
            <Hud label="Points" value={`${stats.points}`} tone="neutral" />
            <Hud label="Walked" value={`${stats.metres} m`} tone="neutral" />
          </View>
          {stats.acres != null ? <Caption style={{ marginTop: spacing.sm }}>About {stats.acres} acres if this GPS holds.</Caption> : null}
          {stats.canClose ? <Caption style={styles.close}>Back at the start. You can close the boundary.</Caption> : null}
          {note ? <Caption style={{ marginTop: spacing.sm }}>{note}</Caption> : null}
          {error ? <Caption style={styles.error}>{error}</Caption> : null}
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <PrimaryButton
              label={walking ? 'Finish boundary' : paused ? 'Resume walking' : 'Start walking'}
              onPress={() => {
                if (walking) finishWalk();
                else if (paused) void resumeWalk();
                else void startWalk();
              }}
            />
            <View style={styles.row}>
              <Pressable onPress={walking ? pauseWalk : undefined} disabled={!walking} style={[styles.small, !walking && styles.smallOff]}>
                <Text style={styles.smallText}>Pause</Text>
              </Pressable>
              <Pressable onPress={undoPoint} disabled={path.length === 0} style={[styles.small, path.length === 0 && styles.smallOff]}>
                <Text style={styles.smallText}>Undo point</Text>
              </Pressable>
              <Pressable onPress={clearPath} style={styles.small}>
                <Text style={styles.smallText}>Start over</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={styles.panel}>
          <H3>Draw the edge</H3>
          <Body style={{ marginTop: spacing.sm }}>Zoom until you can see the land, then tap around it. {drawShape.length} points so far.</Body>
          {draftPoint ? <Caption style={{ marginTop: spacing.sm }}>Last tap saved on this phone.</Caption> : null}
          {error ? <Caption style={styles.error}>{error}</Caption> : null}
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <PrimaryButton label={busy ? 'Saving...' : 'Save boundary'} disabled={busy} onPress={() => void saveShape('DRAWN', drawShape, null)} />
            <Pressable onPress={() => setDrawShape((current) => current.slice(0, -1))} style={styles.small}>
              <Text style={styles.smallText}>Undo last tap</Text>
            </Pressable>
          </View>
        </Card>
      )}
      </ScrollView>
    </AppShell>
  );
}

function Hud({ label, value, tone }: { label: string; value: string; tone: 'good' | 'wait' | 'neutral' }) {
  return (
    <View style={styles.hudBox}>
      <Caption>{label}</Caption>
      <Text style={[styles.hudValue, tone === 'good' && styles.hudGood, tone === 'wait' && styles.hudWait]}>{value}</Text>
    </View>
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
  studio: { flex: 1, paddingBottom: spacing.md },
  sheet: { flex: 1 },
  sheetContent: { paddingBottom: spacing.xl },
  modes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  mode: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  modeText: { color: colors.muted, fontWeight: '800' },
  modeTextOn: { color: '#fff' },
  panel: { marginTop: spacing.md, flexGrow: 1 },
  hud: { flexDirection: 'row', gap: spacing.sm },
  hudBox: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm },
  hudValue: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 2 },
  hudGood: { color: colors.success },
  hudWait: { color: colors.warning },
  close: { marginTop: spacing.sm, color: colors.success, fontWeight: '800' },
  row: { flexDirection: 'row', gap: spacing.sm },
  small: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  smallOff: { opacity: 0.4 },
  smallText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  error: { marginTop: spacing.sm, color: colors.danger, fontWeight: '700' },
  choice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg }
});
