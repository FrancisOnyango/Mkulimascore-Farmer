import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2 } from '@/components/Typography';
import { EmptyState } from '@/components/EmptyState';
import { FarmerRow, FarmerSection } from '@/components/FarmerUX';
import { VerificationStatus } from '@/components/VerificationStatus';
import { FarmerAppService } from '@/application/FarmerAppService';
import { useAppData } from '@/context/AppDataContext';
import { enterpriseActions, parseDairySummary } from '@/lib/enterprises/detail';
import { evidenceStatusLabel } from '@/lib/copy/status';
import type { Enterprise, EvidenceRecord } from '@/domain/types';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/utils/format';

export default function EnterpriseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const { records, markets } = useAppData();

  useEffect(() => {
    if (id) void FarmerAppService.getEnterprise(id).then(setEnterprise);
  }, [id]);

  const enterpriseRecords = useMemo(
    () => records.filter((record) => record.associatedEnterpriseId === enterprise?.id || textMentions(record, enterprise)),
    [enterprise, records]
  );
  const market = markets.find((item) => item.enterpriseId === enterprise?.id);
  const actions = enterprise ? enterpriseActions(enterprise.sector) : [];

  if (!enterprise) return <AppShell><Body>Loading enterprise...</Body></AppShell>;

  return (
    <AppShell>
      <Eyebrow>{enterprise.sector}</Eyebrow>
      <H2 style={{ marginTop: spacing.sm }}>{enterprise.name}</H2>
      <Body style={styles.lead}>{enterprise.summary}</Body>
      <VerificationStatus state="reported" />

      <FarmerSection title="Current status">
        {enterprise.sector === 'Dairy' ? <DairyRows enterprise={enterprise} /> : (
          <FarmerRow
            value={enterprise.productionValue}
            label={enterprise.productionMetric}
            detail={enterprise.buyer ? `Buyer: ${enterprise.buyer}` : undefined}
            last
          />
        )}
      </FarmerSection>

      {market && market.dataStatus !== 'unavailable' ? (
        <FarmerSection title="Market">
          <FarmerRow
            value={`${market.commodity} · ${market.localRange ?? market.observedPrice}`}
            label={[market.marketScope, market.sourceLabel].filter(Boolean).join(' · ')}
            detail={market.dataStatus === 'live' ? undefined : 'Saved reference. Not a live price.'}
            onPress={() => router.push('/insights/markets')}
            last
          />
        </FarmerSection>
      ) : null}

      <FarmerSection title="Records" action="Add" onAction={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: enterprise.id, farmId: enterprise.farmId } })}>
        {enterpriseRecords.length ? enterpriseRecords.slice(0, 5).map((record, index) => (
          <FarmerRow
            key={record.id}
            value={record.title}
            label={`${record.source} · ${formatDate(record.documentDate)}`}
            status={evidenceStatusLabel(record.status)}
            tone={record.status === 'verified' ? 'verified' : ['needs_review', 'failed', 'rejected'].includes(record.status) ? 'attention' : 'neutral'}
            onPress={() => router.push(`/records/${record.id}`)}
            last={index === Math.min(enterpriseRecords.length, 5) - 1}
          />
        )) : (
          <EmptyState
            title="No production records yet"
            body="Add your first milk, harvest or sales record to start building this enterprise history."
            action="Add activity"
            onAction={() => router.push({ pathname: '/add', params: { context: 'enterprise', enterpriseId: enterprise.id, farmId: enterprise.farmId } })}
          />
        )}
      </FarmerSection>

      <View style={styles.quickActions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => router.push({ pathname: action.route as never, params: { enterpriseId: enterprise.id, farmId: enterprise.farmId } })}
            style={styles.quickAction}
          >
            <Text style={styles.quickActionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </AppShell>
  );
}

function DairyRows({ enterprise }: { enterprise: Enterprise }) {
  const dairy = parseDairySummary(enterprise);
  return (
    <>
      {dairy.cattle ? <FarmerRow value={`${dairy.cattle} cattle`} label="Herd" /> : null}
      {dairy.lactating ? <FarmerRow value={`${dairy.lactating} lactating`} label="In milk" /> : null}
      <FarmerRow value={dairy.milk} label="Approximate milk / day" detail={dairy.buyer} last />
    </>
  );
}

function textMentions(record: EvidenceRecord, enterprise: Enterprise | null) {
  if (!enterprise) return false;
  const haystack = `${record.title} ${record.category} ${record.source}`.toLowerCase();
  return haystack.includes(enterprise.sector.toLowerCase());
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xxl },
  quickAction: { minHeight: 48, minWidth: 104, flexGrow: 1, borderRadius: radius.md, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  quickActionText: { color: '#fff', fontWeight: '800', fontSize: 15 }
});
