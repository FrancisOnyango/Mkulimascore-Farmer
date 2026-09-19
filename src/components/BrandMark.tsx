import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

const logo = require('../../assets/icon.png');

export function BrandMark({ size = 48, light = false }: { size?: number; light?: boolean }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="MkulimaScore"
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.10)' : colors.accentSoft }
      ]}
    >
      <Image source={logo} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.66)'
  }
});
