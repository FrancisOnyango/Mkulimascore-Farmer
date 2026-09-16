import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { levelLabel } from '@/lib/warnings/engine';
import type { FarmerAlert } from '@/domain/warnings';

export function AlertCard({
  alert,
  onOpen,
  onAck
}: {
  alert: FarmerAlert;
  onOpen?: () => void;
  onAck?: () => void;
}) {
  const tone = alert.level === 'warning' || alert.level === 'observed_impact'
    ? 'danger'
    : alert.level === 'watch'
      ? 'warning'
      : 'info';
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.infoSoft;
  const accent = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.info;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={alert.title}
      style={({ pressed }) => [styles.card, { backgroundColor: bg, borderColor: accent }, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{levelLabel(alert.level, alert.language)}</Text>
        </View>
        {!alert.officialWarning ? (
          <Text style={styles.prep}>Preparedness</Text>
        ) : (
          <Text style={[styles.prep, { color: colors.danger }]}>Official</Text>
        )}
      </View>
      <Text style={styles.title}>{alert.title}</Text>
      <Text style={styles.body}>{alert.plainLanguageMessage}</Text>
      <Text style={styles.source}>{alert.sourceLabel}</Text>
      {alert.alertOrigin === 'model_derived_watch' || !alert.officialWarning ? (
        <Text style={styles.origin}>Model forecast lane · preparedness only</Text>
      ) : (
        <Text style={[styles.origin, { color: colors.danger }]}>Official warning lane</Text>
      )}
      {alert.actions[0] ? <Text style={styles.action}>Do now: {alert.actions[0].label}</Text> : null}
      <View style={styles.row}>
        {onOpen ? (
          <Pressable onPress={onOpen} style={styles.btnSecondary} accessibilityRole="button">
            <Text style={[styles.btnSecondaryText, { color: accent }]}>View plan</Text>
          </Pressable>
        ) : null}
        {onAck && alert.status === 'active' ? (
          <Pressable onPress={onAck} style={[styles.btnPrimary, { backgroundColor: colors.brandDark }]} accessibilityRole="button">
            <Text style={styles.btnPrimaryText}>I understand</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  prep: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: spacing.sm },
  body: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 },
  source: { color: colors.faint, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  origin: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  action: { color: colors.brandDark, fontSize: 14, fontWeight: '800', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnSecondary: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  btnSecondaryText: { fontWeight: '800', fontSize: 13 },
  btnPrimary: {
    minHeight: 44,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 }
});
