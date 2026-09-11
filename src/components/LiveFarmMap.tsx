import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '@/constants/theme';
import type { Farm } from '@/domain/types';

const DEFAULT_REGION: Region = {
  latitude: -1.0776,
  longitude: 36.7801,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025
};

export function LiveFarmMap({ farm }: { farm: Farm }) {
  const mapRef = useRef<MapView>(null);
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasFarmCoordinate = Number.isFinite(farm.latitude) && Number.isFinite(farm.longitude);
  const hasBoundary = Boolean(farm.boundary && farm.boundary.length >= 3);
  const coordinate = {
    latitude: farm.latitude ?? DEFAULT_REGION.latitude,
    longitude: farm.longitude ?? DEFAULT_REGION.longitude
  };

  useEffect(() => {
    let mounted = true;
    void Location.getForegroundPermissionsAsync().then((result) => {
      if (!mounted) return;
      setPermission(result.status);
    }).catch(() => {
      if (mounted) setPermission(Location.PermissionStatus.DENIED);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function centerOnUser() {
    setLocationError(null);
    if (permission !== Location.PermissionStatus.GRANTED) {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermission(result.status);
      if (result.status !== Location.PermissionStatus.GRANTED) {
        setLocationError('Location permission is off. You can enable it in device settings.');
        return;
      }
    }
    setLocating(true);
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation(current);
      mapRef.current?.animateToRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012
      }, 500);
    } catch {
      setLocationError('We could not get your location. The saved farm location is still shown.');
    } finally {
      setLocating(false);
    }
  }

  function fitFarm() {
    if (hasBoundary && farm.boundary) {
      mapRef.current?.fitToCoordinates(farm.boundary, {
        edgePadding: { top: 72, right: 36, bottom: 72, left: 36 },
        animated: true
      });
      return;
    }
    if (hasFarmCoordinate) {
      mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.014, longitudeDelta: 0.014 }, 500);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...DEFAULT_REGION, ...coordinate }}
        showsUserLocation={permission === Location.PermissionStatus.GRANTED}
        showsMyLocationButton={false}
        loadingEnabled
        accessibilityLabel={`Farm map for ${farm.name}`}
      >
        {hasBoundary && farm.boundary ? (
          <Polygon
            coordinates={farm.boundary}
            strokeColor={colors.brand}
            fillColor="rgba(23,100,59,0.20)"
            strokeWidth={3}
          />
        ) : null}
        {hasFarmCoordinate ? (
          <Marker coordinate={coordinate} title={farm.name} description={farm.mapped ? 'Saved farm location' : 'Approximate farm location'} />
        ) : null}
        {userLocation ? (
          <Marker
            coordinate={{ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude }}
            title="Your current location"
            pinColor={colors.warning}
          />
        ) : null}
      </MapView>
      <View style={styles.overlay}>
        <View style={styles.status}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>{userLocation ? 'Live location on' : hasFarmCoordinate ? farm.mapped ? 'Saved farm location' : 'Approximate location' : 'Location unavailable'}</Text>
        </View>
        <Pressable onPress={() => void centerOnUser()} style={styles.locate} accessibilityRole="button" accessibilityLabel="Center map on my location">
          {locating ? <ActivityIndicator color={colors.brandDark} /> : <Text style={styles.locateText}>Locate me</Text>}
        </Pressable>
      </View>
      <View style={styles.bottomOverlay}>
        <View style={styles.boundaryMeta}>
          <Text style={styles.boundaryTitle}>{hasBoundary ? 'Boundary available' : 'No boundary yet'}</Text>
          <Text style={styles.boundaryText}>
            {hasBoundary
              ? `${farm.measuredArea ?? 'Measured area pending'} ${farm.measuredArea ? farm.areaUnit : ''} measured / ${farm.reportedArea} ${farm.areaUnit} reported`
              : 'Use correction or mapping workflow to add a measured boundary.'}
          </Text>
        </View>
        <Pressable onPress={fitFarm} style={styles.fitButton} accessibilityRole="button" accessibilityLabel="Fit map to farm boundary">
          <Text style={styles.fitText}>Fit farm</Text>
        </Pressable>
      </View>
      {!hasFarmCoordinate ? (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionText}>This farm has no saved coordinates yet. Add or correct its location before using the map.</Text>
        </View>
      ) : permission === Location.PermissionStatus.DENIED ? (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionText}>Location is off. The map is showing the farm's saved location.</Text>
        </View>
      ) : null}
      {locationError ? (
        <View style={styles.errorNotice}>
          <Text style={styles.permissionText}>{locationError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 280, marginTop: spacing.xl, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  map: { flex: 1 },
  overlay: { position: 'absolute', left: spacing.md, right: spacing.md, top: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  locate: { minHeight: 38, justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  locateText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  bottomOverlay: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  boundaryMeta: { flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.md, padding: spacing.md },
  boundaryTitle: { color: colors.brandDark, fontSize: 12, fontWeight: '900' },
  boundaryText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  fitButton: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brandDark, justifyContent: 'center', paddingHorizontal: spacing.md },
  fitText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  permissionNotice: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.94)', padding: spacing.sm },
  permissionText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  errorNotice: { position: 'absolute', top: 58, left: spacing.md, right: spacing.md, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.md, padding: spacing.sm }
});
