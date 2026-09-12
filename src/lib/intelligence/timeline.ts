import type { ConsentGrant, Enterprise, EvidenceRecord, Farm, Passport } from '@/domain/types';
import { locationEvidence } from '@/lib/geo/locationLevel';
import { verificationLabel } from '@/lib/copy/status';

export type TimelineEvent = {
  id: string;
  title: string;
  detail: string;
  at?: string;
};

/** How the agricultural record is growing. Dates only when the phone actually has one. */
export function profileTimeline({
  passport,
  farms,
  enterprises,
  records,
  consents
}: {
  passport: Passport | null;
  farms: Farm[];
  enterprises: Enterprise[];
  records: EvidenceRecord[];
  consents: ConsentGrant[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const farm = farms[0];

  if (passport?.displayName) {
    events.push({
      id: 'identity',
      title: 'Farmer profile started',
      detail: `${passport.displayName}. Added by you.`,
      at: passport.lastUpdated
    });
  }
  if (farm) {
    events.push({
      id: 'farm',
      title: `${farm.name} added`,
      detail: farm.location || 'Place can be marked later.',
      at: farm.boundaryCapturedAt ?? undefined
    });
  }
  if (farm && locationEvidence(farm).level >= 1) {
    events.push({
      id: 'place',
      title: 'Farm place marked',
      detail: 'Weather and nearby markets use this point — not the phone.'
    });
  }
  if (farm?.mapped) {
    events.push({
      id: 'boundary',
      title: farm.boundarySource === 'GPS_WALK' ? 'Boundary walked' : 'Farm shape saved',
      detail: verificationLabel(farm.verification),
      at: farm.boundaryCapturedAt ?? undefined
    });
  }
  const firstEnterprise = enterprises[0];
  if (firstEnterprise) {
    events.push({
      id: 'enterprises',
      title: enterprises.length === 1 ? `${firstEnterprise.sector} added` : `${enterprises.length} enterprises on the farm`,
      detail: enterprises.map((item) => item.sector).join(' · ')
    });
  }
  const latestRecord = [...records].sort((a, b) => +new Date(b.documentDate) - +new Date(a.documentDate))[0];
  if (latestRecord) {
    events.push({
      id: 'record',
      title: latestRecord.verification === 'verified' ? 'Production verified' : 'Production record added',
      detail: `${latestRecord.title}. ${verificationLabel(latestRecord.verification)}.`,
      at: latestRecord.documentDate
    });
  }
  const consent = consents[0];
  if (consent || passport?.affiliations.length) {
    events.push({
      id: 'institution',
      title: 'Cooperative linked',
      detail: consent
        ? `${consent.institution}. Confirmed by your cooperative when they accept the share.`
        : passport?.affiliations.join(' · ') ?? 'Institution linked'
    });
  }
  if (farm?.verification === 'verified') {
    events.push({
      id: 'visit',
      title: 'Farm visit recorded',
      detail: 'Verified during farm visit.'
    });
  }

  return events.slice(-6);
}
