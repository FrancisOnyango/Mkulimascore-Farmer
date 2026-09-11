import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import { useAppData } from '@/context/AppDataContext';
import type { FarmerNotification } from '@/domain/types';
import { colors, spacing } from '@/constants/theme';
import { formatDate, freshnessLabel } from '@/lib/utils/format';
import { FarmerAppService } from '@/application/FarmerAppService';

const labels: Record<FarmerNotification['priority'], string> = {
  action_required: 'Action required',
  evidence_result: 'Evidence result',
  consent: 'Permission',
  financing_status: 'Financing',
  profile_freshness: 'Profile freshness',
  insight_update: 'Insight update'
};

export default function Notifications() {
  const { notifications, alerts, refresh } = useAppData();
  const unreadCount = notifications.filter((item) => !item.read).length;
  async function markAllRead() {
    await FarmerAppService.markAllNotificationsRead();
    await refresh();
  }
  async function openNotification(id: string, deepLink?: string) {
    await FarmerAppService.markNotificationRead(id);
    await refresh();
    if (deepLink) router.push(deepLink as never);
  }
  async function openAlert(deepLink?: string) {
    const relatedNotification = notifications.find((item) => item.deepLink === deepLink && !item.read);
    if (relatedNotification) await FarmerAppService.markNotificationRead(relatedNotification.id);
    await refresh();
    if (deepLink) router.push(deepLink as never);
  }
  return (
    <AppShell>
      <H2>Notifications</H2>
      <Body style={styles.lead}>Important updates only: farm alerts, evidence results, permissions, financing status and profile freshness.</Body>
      {unreadCount ? <Pressable accessibilityRole="button" onPress={() => void markAllRead()} style={styles.markAll}><Text style={styles.markAllText}>Mark all {unreadCount} as read</Text></Pressable> : null}

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {alerts.length ? alerts.map((item) => (
          <Card key={item.id} style={styles.alertCard}>
            <View style={styles.alertRail} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Caption>{item.relatedEntityLabel} / {formatDate(item.createdAt)} / {freshnessLabel(item.createdAt)}</Caption>
                <H3>{item.title}</H3>
                <Body style={{ marginTop: spacing.sm }}>{item.detail}</Body>
              </View>
              <StatusPill label={item.category} tone={item.severity === 'attention' || item.severity === 'urgent' ? 'attention' : 'neutral'} />
            </View>
            {item.deepLink ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => void openAlert(item.deepLink)} style={styles.linkButton}>
                <Text style={styles.linkText}>Open</Text>
              </Pressable>
            ) : null}
          </Card>
        )) : <EmptyState title="No farm alerts" body="Important farm, market, weather, and enterprise updates will appear here." />}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        {notifications.length ? notifications.map((item) => (
          <Card key={item.id} style={!item.read && styles.unreadCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Caption>{formatDate(item.createdAt)} / {freshnessLabel(item.createdAt)}</Caption>
                <View style={styles.titleRow}><H3>{item.title}</H3>{!item.read ? <StatusPill label="New" tone="good" /> : null}</View>
                <Body style={{ marginTop: spacing.sm }}>{item.detail}</Body>
              </View>
              <StatusPill label={labels[item.priority]} tone={item.priority === 'action_required' ? 'attention' : 'neutral'} />
            </View>
            {item.deepLink ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => void openNotification(item.id, item.deepLink)} style={styles.linkButton}>
                <Text style={styles.linkText}>Open</Text>
              </Pressable>
            ) : null}
          </Card>
        )) : <EmptyState title="You are all caught up" body="There are no new notifications to review." />}
      </View>
      <Caption style={styles.note}>Only notifications tied to your farm profile, records, permissions, weather, markets or institution requests are shown here.</Caption>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  alertCard: { overflow: 'hidden' },
  alertRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.warning },
  linkButton: { minHeight: 46, justifyContent: 'center', marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  linkText: { color: colors.brand, fontWeight: '800', fontSize: 15 },
  note: { textAlign: 'center', marginTop: spacing.xxl },
  markAll: { alignSelf: 'flex-start', marginTop: spacing.lg, minHeight: 40, justifyContent: 'center' },
  markAllText: { color: colors.info, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  unreadCard: { borderColor: '#B9D8C4', backgroundColor: '#FCFFFC' }
});
