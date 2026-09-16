import React from 'react';
import { Text, StyleSheet, type TextProps } from 'react-native';
import { colors } from '@/constants/theme';

export function H1(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h1, props.style]} />;
}
export function H2(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h2, props.style]} />;
}
export function H3(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h3, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}
export function Caption(props: TextProps) {
  return <Text {...props} style={[styles.caption, props.style]} />;
}
export function Eyebrow(props: TextProps) {
  return <Text {...props} style={[styles.eyebrow, props.style]} />;
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 21, lineHeight: 28, fontWeight: '800', color: colors.ink },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  caption: { fontSize: 13, lineHeight: 19, color: colors.muted },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.2, color: colors.brand }
});
