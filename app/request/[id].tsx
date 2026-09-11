import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2, H3 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FarmerAppService } from '@/application/FarmerAppService';
import type { InstitutionRequest } from '@/domain/types';
import { colors, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<InstitutionRequest | null>(null);
  useEffect(() => { if (id) void FarmerAppService.getRequest(id).then(setRequest); }, [id]);
  if (!request) return <AppShell><Body>Loading request...</Body></AppShell>;

  return (
    <AppShell>
      <Eyebrow>{request.institution}</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{request.title}</H2>
      <Body style={styles.reason}>{request.reason}</Body>
      {request.dueDate ? <Caption>Due {formatDate(request.dueDate)}</Caption> : null}

      <Card style={{ marginTop: spacing.xl }}>
        <H3>Requested information</H3>
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {request.items.map((item) => <Body key={item}>- {item}</Body>)}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md, backgroundColor: colors.warm }}>
        <H3>Why you are seeing this</H3>
        <Body style={{ marginTop: spacing.sm }}>Institutions should only request information within an authorized purpose and consent scope. Uploading a record does not itself guarantee financing.</Body>
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <PrimaryButton label="Upload requested record" onPress={() => router.push({ pathname: '/add/record', params: { requestId: request.id, institution: request.institution, category: request.items[0] ?? 'Evidence' } })} />
        <PrimaryButton label="Review my permissions" variant="secondary" onPress={() => router.push('/consents')} />
      </View>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  reason: { color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm }
});
