import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Farm } from '@/domain/types';
import { LiveFarmMap } from '@/components/LiveFarmMap';
import { colors, radius, spacing } from '@/constants/theme';

export type MapStudioMode = 'view' | 'pin' | 'draw' | 'walk';
export type MapPoint = { latitude: number; longitude: number };
export type NearbyPin = { name: string; latitude: number; longitude: number; distanceLabel?: string; color?: string };

type Props = {
  farm: Farm;
  mode?: MapStudioMode;
  nearby?: NearbyPin[];
  path?: MapPoint[];
  height?: number;
  follow?: boolean;
  interactive?: boolean;
  showZoom?: boolean;
  onPoint?: (point: MapPoint) => void;
  onPolygon?: (points: MapPoint[]) => void;
  session?: number;
  basemap?: 'map' | 'satellite';
};

export function FarmPlaceMap({
  farm,
  mode = 'view',
  nearby = [],
  path,
  height = 220,
  follow = false,
  interactive = true,
  showZoom = true,
  onPoint,
  onPolygon,
  session = 0,
  basemap = 'map'
}: Props) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const fitted = useRef(false);
  const html = useMemo(() => MAP_HTML, []);

  function send(script: string) {
    webRef.current?.injectJavaScript(`${script}; true;`);
  }

  function pushFarm() {
    const payload = {
      mode,
      latitude: farm.latitude,
      longitude: farm.longitude,
      boundary: farm.boundary ?? [],
      nearby,
      fit: !fitted.current
    };
    send(`window.__mkulima && window.__mkulima.setFarm(${JSON.stringify(payload)})`);
    fitted.current = true;
  }

  function pushPath() {
    send(`window.__mkulima && window.__mkulima.setPath(${JSON.stringify(path ?? [])}, ${follow ? 'true' : 'false'})`);
  }

  useEffect(() => {
    fitted.current = false;
  }, [farm.id, session]);

  useEffect(() => {
    if (ready.current) pushFarm();
  }, [mode, farm.id, farm.latitude, farm.longitude, farm.boundary, nearby]);

  useEffect(() => {
    if (ready.current) send(`window.__mkulima && window.__mkulima.setBasemap('${basemap}')`);
  }, [basemap]);

  useEffect(() => {
    if (ready.current && mode !== 'walk' && mode !== 'draw') {
      send('window.__mkulima && window.__mkulima.clearDraft()');
    }
  }, [session, mode]);

  useEffect(() => {
    if (ready.current) pushPath();
  }, [path, follow]);

  function zoom(direction: 'in' | 'out') {
    send(`window.__mkulima && window.__mkulima.zoom('${direction}')`);
  }

  if (Platform.OS === 'web') {
    return <LiveFarmMap farm={farm} />;
  }

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel={`Farm map for ${farm.name}`}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        nestedScrollEnabled
        overScrollMode="never"
        scalesPageToFit={false}
        pointerEvents={interactive ? 'auto' : 'none'}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              latitude?: number;
              longitude?: number;
              points?: MapPoint[];
            };
            if (message.type === 'ready') {
              ready.current = true;
              pushFarm();
              pushPath();
              send(`window.__mkulima && window.__mkulima.setBasemap('${basemap}')`);
              return;
            }
            if (message.type === 'point' && message.latitude != null && message.longitude != null) {
              onPoint?.({ latitude: message.latitude, longitude: message.longitude });
            }
            if (message.type === 'polygon' && message.points?.length) {
              onPolygon?.(message.points);
            }
          } catch {
            // Ignore malformed map messages.
          }
        }}
      />
      {showZoom && interactive ? (
        <View style={styles.zoom} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => zoom('in')} style={styles.zoomBtn}>
            <Text style={styles.zoomText}>+</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => zoom('out')} style={styles.zoomBtn}>
            <Text style={styles.zoomText}>−</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #E7F2EC; }
    .leaflet-control-attribution { font-size: 9px; }
    .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function post(payload) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    var map, farmLayer, draftLayer, startLayer, osm, sat, mode = 'view', draft = [];
    function boot() {
      if (!window.L) { setTimeout(boot, 200); return; }
      map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 0.25,
        zoomDelta: 0.75,
        minZoom: 5,
        maxZoom: 20,
        tap: true,
        bounceAtZoomLimits: false
      }).setView([-0.23, 37.6], 6);
      osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
      sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, attribution: 'Tiles © Esri' });
      sat.addTo(map);
      farmLayer = L.layerGroup().addTo(map);
      draftLayer = L.layerGroup().addTo(map);
      startLayer = L.layerGroup().addTo(map);
      map.on('click', function (event) {
        if (mode === 'pin') {
          draft = [{ latitude: event.latlng.lat, longitude: event.latlng.lng }];
          drawDraft(false);
          post({ type: 'point', latitude: event.latlng.lat, longitude: event.latlng.lng });
        }
        if (mode === 'draw') {
          draft.push({ latitude: event.latlng.lat, longitude: event.latlng.lng });
          drawDraft(false);
          post({ type: 'polygon', points: draft });
        }
      });
      post({ type: 'ready' });
    }
    function marker(lat, lng, label, color, size) {
      return L.circleMarker([lat, lng], { radius: size || 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(label, { permanent: false });
    }
    function drawFarm(state) {
      farmLayer.clearLayers();
      var bounds = [];
      if (state.boundary && state.boundary.length >= 3) {
        var ring = state.boundary.map(function (p) { return [p.latitude, p.longitude]; });
        L.polygon(ring, { color: '#17643B', weight: 3, fillColor: '#17643B', fillOpacity: 0.22 }).addTo(farmLayer);
        ring.forEach(function (ll) { bounds.push(ll); });
      } else if (state.latitude != null && state.longitude != null) {
        marker(state.latitude, state.longitude, 'Farm', '#0D2F21').addTo(farmLayer);
        bounds.push([state.latitude, state.longitude]);
      }
      (state.nearby || []).forEach(function (item) {
        marker(item.latitude, item.longitude, item.name + (item.distanceLabel ? ' · ' + item.distanceLabel : ''), item.color || '#2F618D', 7).addTo(farmLayer);
        bounds.push([item.latitude, item.longitude]);
      });
      if (state.fit) {
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
        else if (bounds.length === 1) map.setView(bounds[0], 16);
      }
    }
    function drawDraft(follow) {
      draftLayer.clearLayers();
      startLayer.clearLayers();
      if (!draft.length) return;
      var line = draft.map(function (p) { return [p.latitude, p.longitude]; });
      if (draft.length >= 3) {
        L.polygon(line, { color: '#C9A227', weight: 3, fillColor: '#F3E4C0', fillOpacity: 0.32 }).addTo(draftLayer);
      } else if (draft.length === 2) {
        L.polyline(line, { color: '#C9A227', weight: 4 }).addTo(draftLayer);
      } else {
        L.polyline(line, { color: '#C9A227', weight: 4 }).addTo(draftLayer);
      }
      if (draft.length >= 2) L.polyline(line, { color: '#9A5A12', weight: 3 }).addTo(draftLayer);
      var start = draft[0];
      var last = draft[draft.length - 1];
      marker(start.latitude, start.longitude, 'Start', '#17643B', 9).addTo(startLayer);
      if (last && draft.length > 1) marker(last.latitude, last.longitude, 'You', '#9A5A12', 8).addTo(draftLayer);
      if (follow && last) map.setView([last.latitude, last.longitude], Math.max(map.getZoom(), 17));
    }
    window.__mkulima = {
      setFarm: function (state) {
        mode = state.mode || 'view';
        drawFarm(state);
        if (mode === 'view') {
          draft = [];
          draftLayer.clearLayers();
          startLayer.clearLayers();
        }
      },
      setPath: function (points, follow) {
        draft = points || [];
        drawDraft(!!follow);
      },
      clearDraft: function () {
        draft = [];
        if (draftLayer) draftLayer.clearLayers();
        if (startLayer) startLayer.clearLayers();
      },
      setBasemap: function (kind) {
        if (!map || !osm || !sat) return;
        if (kind === 'satellite') { if (map.hasLayer(osm)) map.removeLayer(osm); if (!map.hasLayer(sat)) sat.addTo(map); }
        else { if (map.hasLayer(sat)) map.removeLayer(sat); if (!map.hasLayer(osm)) osm.addTo(map); }
      },
      zoom: function (direction) {
        if (!map) return;
        if (direction === 'in') map.zoomIn(1);
        else map.zoomOut(1);
      }
    };
    boot();
  </script>
</body>
</html>`;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line },
  web: { flex: 1, backgroundColor: colors.brandSoft },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 8 },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(13,47,33,0.92)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  zoomText: { color: '#fff', fontSize: 24, lineHeight: 26, fontWeight: '700' }
});
