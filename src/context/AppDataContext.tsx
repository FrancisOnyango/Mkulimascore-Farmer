import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import type { AskDraft, AskScreen } from '@/domain/ask';
import type {
  ActivityItem,
  AppSettings,
  AskMkulimaMessage,
  ConsentGrant,
  Enterprise,
  EvidenceRecord,
  FarmerNotification,
  FinancingFacility,
  Farm,
  FarmWeather,
  Insight,
  InstitutionRequest,
  ClimateSignal,
  MarketSignal,
  OutboxItem,
  Passport,
  PersonalizedAlert
} from '@/domain/types';
import { FarmerAppService } from '@/application/FarmerAppService';
import { createAskMkulimaClient, type AskActionConfirmPayload, type AskMkulimaAskOptions } from '@/lib/ai/AskMkulimaService';
import { localizeAskText } from '@/lib/i18n/askLanguage';
import { createFarmerApi } from '@/lib/api/ApiClient';
import { isLiveBackend } from '@/lib/api/mode';
import { setStoredMsid } from '@/lib/session/sessionStore';
import { syncPending } from '@/lib/sync/syncEngine';
import {
  applyFarmerProjection,
  addAskMkulimaMessage,
  deleteAllAskMkulimaMessages,
  deleteAskMkulimaMessage,
  getPassport,
  getSettings,
  initDb,
  listActivity,
  listConsents,
  listEnterprises,
  listEvidence,
  listFinancing,
  listFarms,
  listAskMkulimaMessages,
  setLanguage,
  listClimate,
  listInsights,
  listMarkets,
  listNotifications,
  listOutbox,
  listPersonalizedAlerts,
  listWeather,
  listFarmerPlaces,
  saveWeather,
  saveMarket,
  setMarketChangeThresholdPct,
  setSevereWeatherAlerts,
  listRequests
} from '@/db/database';
import { fetchLiveWeather } from '@/lib/weather/liveWeather';
import { fetchLiveMarketData } from '@/lib/markets/liveMarketData';
import { listNearbyPlaces } from '@/lib/places/nearby';
import { registerSevereWeatherAlerts } from '@/lib/notifications/weatherAlerts';

interface AppData {
  ready: boolean;
  refreshing: boolean;
  refreshError: string | null;
  offline: boolean;
  lastUpdatedAt: Date | null;
  lastSyncAt: Date | null;
  passport: Passport | null;
  farms: Farm[];
  enterprises: Enterprise[];
  insights: Insight[];
  records: EvidenceRecord[];
  requests: InstitutionRequest[];
  consents: ConsentGrant[];
  financing: FinancingFacility[];
  notifications: FarmerNotification[];
  weather: FarmWeather[];
  climate: ClimateSignal[];
  markets: MarketSignal[];
  alerts: PersonalizedAlert[];
  settings: AppSettings;
  activity: ActivityItem[];
  outbox: OutboxItem[];
  askMessages: AskMkulimaMessage[];
  selectedFarmId: string | null;
  setSelectedFarmId: (farmId: string) => void;
  refresh: () => Promise<void>;
  askMkulima: (question: string, options?: { screen?: AskScreen; farmId?: string } & AskMkulimaAskOptions) => Promise<void>;
  confirmAskDraft: (draft: AskDraft) => Promise<void>;
  confirmAskAction: (card: { type: string; label: string }, options?: { farmId?: string; question?: string }) => Promise<void>;
  dismissAskDraft: () => Promise<void>;
  deleteAskMessage: (id: string) => Promise<void>;
  clearAskConversation: () => Promise<void>;
  saveLanguage: (language: AppSettings['language']) => Promise<void>;
  saveMarketChangeThreshold: (value: number) => Promise<void>;
  saveSevereWeatherAlerts: (enabled: boolean) => Promise<void>;
}

const Context = createContext<AppData | null>(null);
type AppDataState = Omit<AppData, 'refresh' | 'askMkulima' | 'confirmAskDraft' | 'confirmAskAction' | 'dismissAskDraft' | 'selectedFarmId' | 'setSelectedFarmId' | 'deleteAskMessage' | 'clearAskConversation' | 'saveLanguage' | 'saveMarketChangeThreshold' | 'saveSevereWeatherAlerts'>;

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppDataState>({
    ready: false,
    refreshing: false,
    refreshError: null,
    offline: false,
    lastUpdatedAt: null,
    lastSyncAt: null,
    passport: null,
    farms: [],
    enterprises: [],
    insights: [],
    records: [],
    requests: [],
    consents: [],
    financing: [],
    notifications: [],
    weather: [],
    climate: [],
    markets: [],
    alerts: [],
    settings: { lowDataMode: false, language: 'en', marketChangeThresholdPct: 2, severeWeatherAlerts: true },
    activity: [],
    outbox: [],
    askMessages: []
  });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setData((current) => ({ ...current, refreshing: true, refreshError: null }));
    try {
      await initDb();
      let offline = false;
      let synced = false;
      try {
        const network = await Network.getNetworkStateAsync();
        offline = !network.isConnected || network.isInternetReachable === false;
        if (!offline) {
          const syncResult = await syncPending();
          synced = syncResult.synced > 0;
          offline = syncResult.offline;
          if (isLiveBackend() && !offline) {
            try {
              const projection = await createFarmerApi().pullProjections();
              if (projection) await applyFarmerProjection(projection);
            } catch {
              // Cached SQLite projections remain when farmer reads are not deployed yet.
            }
          }
        }
      } catch {
        // Local SQLite data remains usable when network status or sync is unavailable.
        offline = true;
      }
      const farmSnapshot = await listFarms();
      const settingsSnapshot = await getSettings();
      const allowLiveFetch = !offline && !settingsSnapshot.lowDataMode;
      if (allowLiveFetch) {
        await Promise.all(farmSnapshot.filter((farm) => farm.latitude != null && farm.longitude != null).map(async (farm) => {
          try {
            const liveWeather = await fetchLiveWeather(farm);
            if (liveWeather) await saveWeather(liveWeather);
          } catch {
            // Cached SQLite weather remains available when the live provider is unreachable.
          }
        }));
      }
      const locatedFarm = farmSnapshot.find((farm) => farm.latitude != null && farm.longitude != null);
      const marketResult = allowLiveFetch
        ? await fetchLiveMarketData({
          latitude: locatedFarm?.latitude,
          longitude: locatedFarm?.longitude
        })
        : { status: 'cached' as const, sourceLabel: 'Saved market reference', markets: [] };
      await Promise.all(marketResult.markets.map((market) => saveMarket(market)));
      const [passport, farms, enterprises, insights, records, requests, consents, financing, notifications, weather, climate, markets, alerts, settings, activity, outbox, askMessages] = await Promise.all([
        getPassport(),
        listFarms(),
        listEnterprises(),
        listInsights(),
        listEvidence(),
        listRequests(),
        listConsents(),
        listFinancing(),
        listNotifications(),
        listWeather(),
        listClimate(),
        listMarkets(),
        listPersonalizedAlerts(),
        getSettings(),
        listActivity(),
        listOutbox(),
        listAskMkulimaMessages()
      ]);
      if (passport?.msid) await setStoredMsid(passport.msid);
      setData((current) => ({
        ready: true,
        refreshing: false,
        refreshError: null,
        offline,
        lastUpdatedAt: new Date(),
        lastSyncAt: synced ? new Date() : current.lastSyncAt,
        passport,
        farms,
        enterprises,
        insights,
        records,
        requests,
        consents,
        financing,
        notifications,
        weather,
        climate,
        markets: markets.map((market) => market.dataStatus ? market : { ...market, dataStatus: marketResult.status === 'unavailable' ? 'cached' : marketResult.status, sourceLabel: marketResult.sourceLabel }),
        alerts,
        settings,
        activity,
        outbox,
        askMessages
      }));
    } catch (error) {
      setData((current) => ({
        ...current,
        refreshing: false,
        refreshError: 'We could not refresh your data. Check your connection and try again.'
      }));
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  const askMkulima = useCallback(async (question: string, options?: { screen?: AskScreen; farmId?: string } & AskMkulimaAskOptions) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    await initDb();
    const farmerMessage = await addAskMkulimaMessage({ role: 'farmer', text: trimmed });
    const farmId = options?.farmId ?? selectedFarmId;
    const farm = data.farms.find((item) => item.id === farmId) ?? data.farms[0];
    const extras = await listFarmerPlaces();
    const places = listNearbyPlaces({
      farm,
      enterprises: data.enterprises.filter((item) => !farm || item.farmId === farm.id),
      liveMarkets: data.markets,
      extras
    });
    const snapshot = {
      passport: data.passport,
      selectedFarmId: farmId,
      screenContext: options?.screen ? { screen: options.screen, farmId: farm?.id } : undefined,
      farms: data.farms,
      enterprises: data.enterprises,
      insights: data.insights,
      records: data.records,
      requests: data.requests,
      consents: data.consents,
      financing: data.financing,
      outbox: data.outbox,
      weather: data.weather,
      climate: data.climate,
      markets: data.markets,
      alerts: data.alerts,
      activity: data.activity,
      places
    };
    try {
      const reply = await createAskMkulimaClient().ask(
        trimmed,
        { ...snapshot, language: data.settings.language },
        [...data.askMessages, farmerMessage],
        { imageDataUrl: options?.imageDataUrl, attachmentId: options?.attachmentId }
      );
      await addAskMkulimaMessage({ role: 'assistant', text: reply.text, metadata: reply.metadata });
      await refresh();
    } catch (error) {
      // Do not leave an unanswered farmer message that would be duplicated by Retry.
      await deleteAskMkulimaMessage(farmerMessage.id);
      throw error;
    }
  }, [data.activity, data.alerts, data.askMessages, data.climate, data.consents, data.enterprises, data.farms, data.financing, data.insights, data.markets, data.outbox, data.passport, data.records, data.requests, data.settings.language, data.weather, refresh, selectedFarmId]);

  const confirmAskAction = useCallback(async (card: { type: string; label: string }, options?: { farmId?: string; question?: string }) => {
    await initDb();
    const client = createAskMkulimaClient();
    const actionId = `ask-${Date.now()}`;
    const farmId = options?.farmId ?? selectedFarmId ?? data.farms[0]?.id;
    const payload: AskActionConfirmPayload = {
      type: card.type,
      label: card.label,
      farmId: farmId ?? undefined,
      summary: card.label,
      question: options?.question,
      confirmed: true
    };
    const result = client.confirmAction
      ? await client.confirmAction(actionId, payload)
      : { status: 'ACCEPTED', note: 'Saved as provisional.' };
    await addAskMkulimaMessage({
      role: 'assistant',
      text: localizeAskText(
        result.status === 'ACCEPTED'
          ? 'Noted as provisional. Nothing verified was overwritten. You can finish this from Activity or with an officer.'
          : result.note || 'I could not confirm that action yet.',
        data.settings.language
      )
    });
    await refresh();
  }, [data.farms, data.settings.language, refresh, selectedFarmId]);

  const confirmAskDraft = useCallback(async (draft: AskDraft) => {
    await initDb();
    const enterpriseId = draft.enterpriseId ?? data.enterprises.find((item) => item.primary)?.id ?? data.enterprises[0]?.id;
    if (!enterpriseId) {
      await addAskMkulimaMessage({
        role: 'assistant',
        text: localizeAskText('I understood the figure, but I cannot save it until you add what you grow or keep.', data.settings.language)
      });
      await refresh();
      return;
    }
    if (draft.kind === 'production' && draft.quantity != null && draft.unit) {
      await FarmerAppService.submitProduction({
        enterpriseId,
        metric: draft.unit === 'litres' ? 'Milk' : 'Harvest',
        quantity: draft.quantity,
        unit: draft.unit,
        occurredAt: draft.occurredAt,
        note: draft.note
      });
    } else if (draft.kind === 'cost' && draft.amount != null) {
      await FarmerAppService.submitCost({
        enterpriseId,
        category: draft.category || 'Other',
        amount: draft.amount,
        currency: 'KES',
        occurredAt: draft.occurredAt,
        note: draft.note
      });
    } else {
      await addAskMkulimaMessage({
        role: 'assistant',
        text: localizeAskText('I am missing a quantity or amount, so I did not save anything.', data.settings.language)
      });
      await refresh();
      return;
    }
    await addAskMkulimaMessage({
      role: 'assistant',
      text: localizeAskText('Saved. Added by you — not checked during a farm visit. You can correct it from Activity if I misunderstood.', data.settings.language)
    });
    await refresh();
  }, [data.enterprises, data.settings.language, refresh]);

  const dismissAskDraft = useCallback(async () => {
    await addAskMkulimaMessage({
      role: 'assistant',
      text: localizeAskText('Not saved. Tell me again if you want to add it later.', data.settings.language)
    });
    await refresh();
  }, [data.settings.language, refresh]);

  const deleteAskMessage = useCallback(async (id: string) => {
    await deleteAskMkulimaMessage(id);
    await refresh();
  }, [refresh]);

  const clearAskConversation = useCallback(async () => {
    await deleteAllAskMkulimaMessages();
    await refresh();
  }, [refresh]);

  const saveLanguage = useCallback(async (language: AppSettings['language']) => {
    await setLanguage(language);
    await refresh();
  }, [refresh]);

  const saveMarketChangeThreshold = useCallback(async (value: number) => {
    await setMarketChangeThresholdPct(value);
    await refresh();
  }, [refresh]);

  const saveSevereWeatherAlerts = useCallback(async (enabled: boolean) => {
    await setSevereWeatherAlerts(enabled);
    await registerSevereWeatherAlerts(enabled);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(handle);
  }, [refresh]);

  useEffect(() => {
    const active = { value: AppState.currentState === 'active' };
    const interval = setInterval(() => {
      if (active.value) void refresh();
    }, 5 * 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      active.value = state === 'active';
      if (active.value) void refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]);

  const activeFarmId = selectedFarmId ?? data.farms[0]?.id ?? null;
  const value = useMemo(
    () => ({ ...data, selectedFarmId: activeFarmId, setSelectedFarmId, refresh, askMkulima, confirmAskDraft, confirmAskAction, dismissAskDraft, deleteAskMessage, clearAskConversation, saveLanguage, saveMarketChangeThreshold, saveSevereWeatherAlerts }),
    [activeFarmId, askMkulima, clearAskConversation, confirmAskAction, confirmAskDraft, data, deleteAskMessage, dismissAskDraft, refresh, saveLanguage, saveMarketChangeThreshold, saveSevereWeatherAlerts]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppData() {
  const value = useContext(Context);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
