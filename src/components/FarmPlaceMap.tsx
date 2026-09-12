import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Farm } from '@/domain/types';
import { LiveFarmMap } from '@/components/LiveFarmMap';
import { colors, radius, spacing } from '@/constants/theme';

export type MapStudioMode = 'view' | 'pin' | 'draw' | 'walk';
export type MapPoint = { latitude: number; longitude: number };
export type NearbyPin = { name: string; latitude: number; longitude: number; distanceLabel?: string };

type Props = {
  farm: Farm;
  mode?: MapStudioMode;
  nearby?: NearbyPin[];
  height?: number;
  onPoint?: (point: MapPoint) => void;
  onPolygon?: (points: MapPoint[]) => void;
  walkPoint?: MapPoint | null;
  session?: number;
  basemap?: 'map' | 'satellite';
};

export function FarmPlaceMap({ farm, mode = 'view', nearby = [], height = 220, onPoint, onPolygon, walkPoint, session = 0, basemap = 'map' }: Props) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const html = useMemo(() => MAP_HTML, []);

  function send(script: string) {
    webRef.current?.injectJavaScript(`${script}; true;`);
  }

  function pushState() {
    const payload = {
      mode,
      latitude: farm.latitude,
      longitude: farm.longitude,
      boundary: farm.boundary ?? [],
      nearby
    };
    send(`window.__mkulima && window.__mkulima.setState(${JSON.stringify(payload)})`);
  }

  useEffect(() => {
    if (ready.current) pushState();
  }, [mode, farm.latitude, farm.longitude, farm.boundary, nearby]);

  useEffect(() => {
    if (ready.current) send(`window.__mkulima && window.__mkulima.setBasemap('${basemap}')`);
  }, [basemap]);

  useEffect(() => {
    if (ready.current) send('window.__mkulima && window.__mkulima.clearDraft()');
  }, [session, mode]);

  useEffect(() => {
    if (walkPoint && ready.current) {
      send(`window.__mkulima && window.__mkulima.addWalk(${walkPoint.latitude}, ${walkPoint.longitude})`);
    }
  }, [walkPoint]);

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
              pushState();
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
    </View>
  );
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #E7F2EC; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function post(payload) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    var map, farmLayer, draftLayer, osm, sat, mode = 'view', draft = [];
    function boot() {
      if (!window.L) { setTimeout(boot, 200); return; }
      map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-0.23, 37.6], 6);
      osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
      sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' });
      osm.addTo(map);
      farmLayer = L.layerGroup().addTo(map);
      draftLayer = L.layerGroup().addTo(map);
      map.on('click', function (event) {
        if (mode === 'pin') {
          draft = [{ latitude: event.latlng.lat, longitude: event.latlng.lng }];
          drawDraft();
          post({ type: 'point', latitude: event.latlng.lat, longitude: event.latlng.lng });
        }
        if (mode === 'draw') {
          draft.push({ latitude: event.latlng.lat, longitude: event.latlng.lng });
          drawDraft();
          post({ type: 'polygon', points: draft });
        }
      });
      post({ type: 'ready' });
    }
    function marker(lat, lng, label, color) {
      return L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(label, { permanent: false });
    }
    function drawFarm(state) {
      farmLayer.clearLayers();
      var bounds = [];
      if (state.boundary && state.boundary.length >= 3) {
        var ring = state.boundary.map(function (p) { return [p.latitude, p.longitude]; });
        L.polygon(ring, { color: '#17643B', weight: 3, fillColor: '#17643B', fillOpacity: 0.28 }).addTo(farmLayer);
        ring.forEach(function (ll) { bounds.push(ll); });
      } else if (state.latitude != null && state.longitude != null) {
        marker(state.latitude, state.longitude, 'Farm', '#0D2F21').addTo(farmLayer);
        bounds.push([state.latitude, state.longitude]);
      }
      (state.nearby || []).forEach(function (item) {
        marker(item.latitude, item.longitude, item.name + (item.distanceLabel ? ' · ' + item.distanceLabel : ''), '#2F618D').addTo(farmLayer);
        bounds.push([item.latitude, item.longitude]);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
      else if (bounds.length === 1) map.setView(bounds[0], 15);
    }
    function drawDraft() {
      draftLayer.clearLayers();
      if (!draft.length) return;
      if (draft.length >= 3) {
        L.polygon(draft.map(function (p) { return [p.latitude, p.longitude]; }), { color: '#9A5A12', weight: 3, fillColor: '#F3E4C0', fillOpacity: 0.35 }).addTo(draftLayer);
      } else if (draft.length === 2) {
        L.polyline(draft.map(function (p) { return [p.latitude, p.longitude]; }), { color: '#9A5A12', weight: 3 }).addTo(draftLayer);
      }
      draft.forEach(function (p) { marker(p.latitude, p.longitude, '', '#9A5A12').addTo(draftLayer); });
    }
    window.__mkulima = {
      setState: function (state) {
        mode = state.mode || 'view';
        if (mode !== 'walk' && mode !== 'draw') draft = [];
        drawFarm(state);
        if (mode === 'view') draftLayer.clearLayers();
      },
      addWalk: function (lat, lng) {
        draft.push({ latitude: lat, longitude: lng });
        drawDraft();
        if (map) map.setView([lat, lng], Math.max(map.getZoom(), 16));
        post({ type: 'polygon', points: draft });
      },
      clearDraft: function () {
        draft = [];
        if (draftLayer) draftLayer.clearLayers();
      },
      setBasemap: function (kind) {
        if (!map || !osm || !sat) return;
        if (kind === 'satellite') { map.removeLayer(osm); sat.addTo(map); }
        else { map.removeLayer(sat); osm.addTo(map); }
      }
    };
    boot();
  </script>
</body>
</html>`;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line },
  web: { flex: 1, backgroundColor: colors.brandSoft }
});
