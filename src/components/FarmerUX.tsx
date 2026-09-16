import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Body, Caption, H2, H3, Eyebrow } from '@/components/Typography';
import { StatusPill } from '@/components/StatusPill';
import { colors, radius, spacing } from '@/constants/theme';

type Tone = 'good' | 'attention' | 'neutral' | 'verified' | 'danger';

export function FarmerStatusPanel({
  eyebrow,
  title,
  body,
  statusLabel,
  statusTone = 'neutral',
  primaryAction,
  secondaryAction
}: {
  eyebrow: string;
  title: string;
  body: string;
  statusLabel: string;
  statusTone?: Tone;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.statusPanel}>
      <View style={styles.panelHeader}>
        <Eyebrow style={styles.panelEyebrow}>{eyebrow}</Eyebrow>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>
      <H2 style={styles.panelTitle}>{title}</H2>
      <Body style={styles.panelBody}>{body}</Body>
      {primaryAction || secondaryAction ? (
        <View style={styles.actionRow}>
          {primaryAction ? <PlainAction label={primaryAction.label} onPress={primaryAction.onPress} primary /> : null}
          {secondaryAction ? <PlainAction label={secondaryAction.label} onPress={secondaryAction.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function FarmerSection({
  title,
  detail,
  action,
  onAction,
  children,
  style
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <H3>{title}</H3>
          {detail ? <Caption style={styles.sectionDetail}>{detail}</Caption> : null}
        </View>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

export function FarmerRow({
  label,
  value,
  detail,
  status,
  tone = 'neutral',
  onPress,
  last = false
}: {
  label: string;
  value: string;
  detail?: string;
  status?: string;
  tone?: Tone;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <>
      <View style={styles.rowText}>
        <Body style={styles.rowValue}>{value}</Body>
        <Caption style={styles.rowLabel}>{label}</Caption>
        {detail ? <Caption style={styles.rowDetail}>{detail}</Caption> : null}
      </View>
      {status ? <StatusPill label={status} tone={tone} /> : onPress ? <Text style={styles.chevron}>{'>'}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value}. ${label}`} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, !last && styles.rowBorder]}>{content}</View>;
}

export function PlainAction({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.plainAction, primary && styles.plainActionPrimary]}>
      <Text style={[styles.plainActionText, primary && styles.plainActionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  panelEyebrow: { color: colors.brand },
  panelTitle: { marginTop: spacing.md },
  panelBody: { marginTop: spacing.sm, color: colors.text },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  plainAction: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.lg },
  plainActionPrimary: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  plainActionText: { color: colors.brandDark, fontWeight: '900', fontSize: 13 },
  plainActionTextPrimary: { color: '#fff' },
  section: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.sm },
  sectionDetail: { marginTop: 2 },
  sectionAction: { minHeight: 36, justifyContent: 'center' },
  sectionActionText: { color: colors.info, fontWeight: '900', fontSize: 13 },
  rows: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowText: { flex: 1, minWidth: 0 },
  rowValue: { color: colors.ink, fontWeight: '900' },
  rowLabel: { marginTop: 2 },
  rowDetail: { marginTop: spacing.xs, color: colors.muted },
  chevron: { color: colors.faint, fontSize: 22, fontWeight: '600' },
  pressed: { opacity: 0.88 }
});
