import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { AppShell } from '@/components/AppShell';
import { BrandMark } from '@/components/BrandMark';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';
import { startVoiceInput } from '@/lib/voice/voiceInput';
import { startersForScreen } from '@/lib/ai/askPolicy';
import { createAskMkulimaClient } from '@/lib/ai/AskMkulimaService';
import { ASK_UI, localizeAskList } from '@/lib/i18n/askLanguage';
import { getAskMkulimaIntegrationStatus, type AskMkulimaIntegrationStatus } from '@/lib/ai/AskMkulimaIntegration';
import type { AskScreen } from '@/domain/ask';
import type { AskActionCard, AskMkulimaMessage } from '@/domain/types';

const CONFIRMABLE_ACTIONS = new Set([
  'create_profile_update_request',
  'profile_update',
  'planting_date',
  'create_activity_draft',
  'activity',
  'save_activity',
  'report_pest_or_disease',
  'pest',
  'disease',
  'submit_impact_report',
  'impact',
  'escalate_to_officer',
  'escalation'
]);

function getContextualStarters({
  weather,
  markets,
  requests,
  farms,
  enterprises,
  records,
  insights,
  outbox
}: Pick<ReturnType<typeof useAppData>, 'weather' | 'markets' | 'requests' | 'farms' | 'enterprises' | 'records' | 'insights' | 'outbox'>): string[] {
  const suggestions: string[] = [];
  if (weather.length) suggestions.push('How is the weather for my farm?');
  if (markets.length) suggestions.push('What is the latest price near me?');
  if (farms.some((farm) => farm.latitude != null)) suggestions.push('Where can I sell near my farm?');
  suggestions.push('What fertilizer prices can you see?');
  if (enterprises.length) suggestions.push('How is my production?');
  if (records.some((record) => /cost|expense/i.test(`${record.category} ${record.title}`))) suggestions.push('What have I spent?');
  if (requests.some((request) => request.status === 'open')) suggestions.push('What record is still needed?');
  if (farms.some((farm) => !farm.mapped)) suggestions.push('Is my farm mapped?');
  if (outbox.some((item) => item.state !== 'SYNCED')) suggestions.push('What is still waiting to send?');
  if (suggestions.length === 0) suggestions.push('How is the weather for my farm?');
  return [...new Set(suggestions)].slice(0, 4);
}

export default function AskMkulima() {
  const params = useLocalSearchParams<{ screen?: string; farmId?: string }>();
  const screen = (params.screen as AskScreen | undefined) ?? 'ask';
  const {
    askMessages,
    askMkulima,
    confirmAskDraft,
    confirmAskAction,
    dismissAskDraft,
    clearAskConversation,
    settings,
    weather,
    markets,
    requests,
    farms,
    enterprises,
    records,
    insights,
    outbox,
    offline,
    ready
  } = useAppData();
  const ui = ASK_UI[settings.language];
  const starters = useMemo(() => {
    const fromScreen = startersForScreen(screen, settings.language);
    if (fromScreen.length) return fromScreen;
    return localizeAskList(getContextualStarters({ weather, markets, requests, farms, enterprises, records, insights, outbox }), settings.language);
  }, [enterprises, farms, insights, markets, outbox, records, requests, screen, settings.language, weather]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState('');
  const [openedSource, setOpenedSource] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; dataUrl: string; contentType: string } | null>(null);
  const [integration, setIntegration] = useState<AskMkulimaIntegrationStatus | null>(null);
  const listRef = useRef<FlatList<AskMkulimaMessage>>(null);
  const showVoice = Platform.OS === 'web';

  useEffect(() => {
    let mounted = true;
    void getAskMkulimaIntegrationStatus().then((status) => {
      if (mounted) setIntegration(status);
    });
    return () => {
      mounted = false;
      Speech.stop();
    };
  }, []);

  async function send(text = question) {
    const photo = pendingPhoto;
    const trimmed = text.trim() || (photo ? ui.photoPrompt : '');
    if ((!trimmed && !photo) || sending) return;
    setSending(true);
    setError(null);
    setQuestion('');
    setPendingPhoto(null);
    try {
      let attachmentId: string | undefined;
      if (photo) {
        const client = createAskMkulimaClient();
        const registered = client.registerAttachment
          ? await client.registerAttachment({
              farmId: params.farmId,
              contentType: photo.contentType,
              purpose: 'crop_or_livestock_assessment'
            })
          : null;
        attachmentId = registered?.id;
      }
      await askMkulima(trimmed, {
        screen,
        farmId: params.farmId,
        imageDataUrl: photo?.dataUrl,
        attachmentId
      });
      setFailedQuestion('');
    } catch (sendError) {
      setQuestion(trimmed);
      setFailedQuestion(trimmed);
      const code = sendError instanceof Error ? sendError.message : '';
      setError(
        code === 'ASK_MKULIMA_RATE_LIMITED'
          ? ui.busy
          : code === 'ASK_MKULIMA_TIMEOUT'
            ? ui.timeout
            : code === 'AUTH_REQUIRED'
              ? ui.auth
              : ui.fail
      );
    } finally {
      setSending(false);
    }
  }

  async function pickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(ui.title, ui.photoFail);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.55,
        base64: true,
        allowsEditing: true
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert(ui.title, ui.photoFail);
        return;
      }
      const contentType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
      const dataUrl = `data:${contentType};base64,${asset.base64}`;
      setPendingPhoto({ uri: asset.uri, dataUrl, contentType });
      if (!question.trim()) setQuestion(ui.photoPrompt);
    } catch {
      Alert.alert(ui.title, ui.photoFail);
    }
  }

  async function listen() {
    setListening(true);
    try {
      const spoken = await startVoiceInput(settings.language);
      if (spoken) {
        setQuestion(spoken);
        await send(spoken);
      }
    } catch {
      Alert.alert(ui.title, ui.voiceFail);
    } finally {
      setListening(false);
    }
  }

  function toggleSpeech(message: AskMkulimaMessage) {
    if (speakingId === message.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    Speech.stop();
    setSpeakingId(message.id);
    Speech.speak(message.text, {
      language: settings.language === 'sw' ? 'sw-KE' : 'en-KE',
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null)
    });
  }

  const lastAssistantId = [...askMessages].reverse().find((item) => item.role === 'assistant')?.id;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppShell scroll={false} contentStyle={styles.shell}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.brandDark} />
          </Pressable>
          <BrandMark size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{ui.title}</Text>
            <Text style={styles.status}>
              {!ready ? ui.openingBook : offline ? ui.offline : integrationLabel(integration, settings.language)}
            </Text>
          </View>
          {askMessages.length ? (
            <Pressable onPress={() => void clearAskConversation()} accessibilityRole="button" accessibilityLabel={ui.clear} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={listRef}
          style={styles.list}
          data={askMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <BrandMark size={56} />
              <Text style={styles.emptyTitle}>{ui.emptyTitle}</Text>
              <Text style={styles.emptyBody}>{ui.emptyBody}</Text>
              <View style={styles.starters}>
                {starters.map((starter) => (
                  <Pressable key={starter} onPress={() => void send(starter)} disabled={sending} accessibilityRole="button" accessibilityLabel={`Ask: ${starter}`} style={styles.starter}>
                    <Text style={styles.starterText}>{starter}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              last={item.id === lastAssistantId}
              sending={sending}
              opened={openedSource === item.id}
              speaking={speakingId === item.id}
              ui={ui}
              onToggleSource={() => setOpenedSource((current) => (current === item.id ? null : item.id))}
              onFollowUp={(followUp) => void send(followUp)}
              onSpeak={() => toggleSpeech(item)}
              onConfirmAction={(card) => void confirmAskAction(card, { farmId: params.farmId, question: item.text })}
              onConfirmDraft={item.metadata?.draft ? () => void confirmAskDraft(item.metadata!.draft!) : undefined}
              onDismissDraft={item.metadata?.draft ? () => void dismissAskDraft() : undefined}
            />
          )}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <BrandMark size={28} />
                <View style={styles.typingBubble}>
                  <ActivityIndicator color={colors.brand} size="small" />
                  <Text style={styles.typingText}>{ui.typing}</Text>
                </View>
              </View>
            ) : null
          }
        />

        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void send(failedQuestion)} disabled={!failedQuestion || sending} style={styles.retry}>
              <Text style={styles.retryText}>{ui.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {pendingPhoto ? (
          <View style={styles.photoPending}>
            <Ionicons name="image-outline" size={16} color={colors.brandDark} />
            <Text style={styles.photoPendingText}>{ui.addPhoto}</Text>
            <Pressable onPress={() => setPendingPhoto(null)} accessibilityRole="button">
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable onPress={() => void pickPhoto()} disabled={sending} accessibilityRole="button" accessibilityLabel={ui.addPhoto} style={[styles.voice, sending && styles.disabled]}>
            <Ionicons name="camera-outline" size={20} color={colors.brandDark} />
          </Pressable>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={ui.placeholder}
            placeholderTextColor={colors.faint}
            multiline
            maxLength={400}
            editable={!sending}
            accessibilityLabel="Question for Ask Mkulima"
            style={styles.input}
          />
          {showVoice ? (
            <Pressable onPress={() => void listen()} disabled={sending || listening} accessibilityRole="button" accessibilityLabel="Use voice" style={[styles.voice, (sending || listening) && styles.disabled]}>
              {listening ? <ActivityIndicator color={colors.brandDark} /> : <Ionicons name="mic-outline" size={20} color={colors.brandDark} />}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void send()}
            disabled={sending || (!question.trim() && !pendingPhoto)}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, (sending || (!question.trim() && !pendingPhoto)) && styles.disabled]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </Pressable>
        </View>
      </AppShell>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  last,
  sending,
  opened,
  speaking,
  onToggleSource,
  onFollowUp,
  onSpeak,
  onConfirmAction,
  onConfirmDraft,
  onDismissDraft,
  ui
}: {
  message: AskMkulimaMessage;
  last: boolean;
  sending: boolean;
  opened: boolean;
  speaking: boolean;
  ui: (typeof ASK_UI)[keyof typeof ASK_UI];
  onToggleSource: () => void;
  onFollowUp: (text: string) => void;
  onSpeak: () => void;
  onConfirmAction: (card: AskActionCard) => void;
  onConfirmDraft?: () => void;
  onDismissDraft?: () => void;
}) {
  if (message.role === 'farmer') {
    return (
      <View style={[styles.bubble, styles.farmerBubble]}>
        <Text style={styles.farmerText}>{message.text}</Text>
      </View>
    );
  }

  const sources = message.metadata?.sources ?? [];
  const localOnly = message.metadata?.localOnly;

  return (
    <View style={styles.assistantRow}>
      <BrandMark size={28} />
      <View style={[styles.bubble, styles.assistantBubble]}>
        <Text style={styles.assistantText}>{message.text}</Text>
        <Pressable onPress={onSpeak} accessibilityRole="button" accessibilityLabel={speaking ? ui.stopListen : ui.listen} style={styles.speakBtn}>
          <Ionicons name={speaking ? 'stop-circle-outline' : 'volume-medium-outline'} size={16} color={colors.brand} />
          <Text style={styles.speakText}>{speaking ? ui.stopListen : ui.listen}</Text>
        </Pressable>
        {localOnly ? <Text style={styles.fromPhone}>{ui.fromPhone}</Text> : null}
        {message.metadata?.actionCards?.length ? (
          <View style={styles.actionCards}>
            {message.metadata.actionCards.slice(0, 3).map((card) => (
              <Pressable
                key={`${message.id}-${card.type}-${card.label}`}
                onPress={() => {
                  if (CONFIRMABLE_ACTIONS.has(card.type)) {
                    onConfirmAction(card);
                    return;
                  }
                  if (card.type === 'check_weather_window') {
                    onFollowUp('How is the weather for my farm?');
                    return;
                  }
                  onFollowUp(card.label);
                }}
                accessibilityRole="button"
                style={styles.actionCard}
              >
                <Text style={styles.actionCardText}>
                  {CONFIRMABLE_ACTIONS.has(card.type) ? `${ui.confirmAction}: ${card.label}` : card.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {sources.length ? (
          <Pressable onPress={onToggleSource} accessibilityRole="button" style={styles.how}>
            <Text style={styles.howText}>{opened ? ui.hideHow : ui.how}</Text>
          </Pressable>
        ) : null}
        {opened ? (
          <View style={styles.sourceBox}>
            {sources.map((item) => (
              <Text key={`${message.id}-${item.label}`} style={styles.sourceLine}>
                {item.label}. {item.freshness}.{item.limitation ? ` ${item.limitation}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
        {last && message.metadata?.draft && !sending && onConfirmDraft ? (
          <View style={styles.draftRow}>
            <Pressable onPress={onConfirmDraft} accessibilityRole="button" style={styles.saveDraft}>
              <Text style={styles.saveDraftText}>{ui.saveDraft}</Text>
            </Pressable>
            <Pressable onPress={onDismissDraft} accessibilityRole="button" style={styles.skipDraft}>
              <Text style={styles.skipDraftText}>{ui.notNow}</Text>
            </Pressable>
          </View>
        ) : null}
        {last && message.metadata?.followUps.length && !sending && !message.metadata.draft ? (
          <View style={styles.inlineFollow}>
            {message.metadata.followUps.slice(0, 2).map((followUp) => (
              <Pressable key={followUp} onPress={() => onFollowUp(followUp)} style={styles.followUp}>
                <Text style={styles.followUpText}>{followUp}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function integrationLabel(status: AskMkulimaIntegrationStatus | null, language: 'en' | 'sw' = 'en') {
  const ui = ASK_UI[language];
  if (!status) return ui.opening;
  if (status.state === 'ready') return ui.live;
  if (status.state === 'auth_required') return ui.phoneSignIn;
  return ui.onPhone;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  shell: { paddingHorizontal: 0, paddingTop: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  status: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.md },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: spacing.lg },
  emptyBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm, maxWidth: 320 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl },
  starter: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  starterText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  farmerBubble: { alignSelf: 'flex-end', backgroundColor: colors.brandDark, borderBottomRightRadius: 6 },
  farmerText: { color: '#fff', fontSize: 16, lineHeight: 23 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '94%' },
  assistantBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  assistantText: { color: colors.text, fontSize: 16, lineHeight: 23 },
  speakBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  speakText: { color: colors.brand, fontWeight: '800', fontSize: 12 },
  fromPhone: { color: colors.faint, fontSize: 11, fontWeight: '700', marginTop: spacing.sm },
  how: { marginTop: spacing.sm },
  howText: { color: colors.brand, fontWeight: '800', fontSize: 12 },
  actionCards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionCard: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  actionCardText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 },
  sourceBox: { marginTop: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  sourceLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  inlineFollow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  draftRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  saveDraft: {
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  saveDraftText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  skipDraft: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  skipDraftText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  typingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  followUp: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.brandSoft
  },
  followUpText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  errorRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.claySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  errorText: { flex: 1, color: colors.clay, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  retry: { minHeight: 36, borderRadius: radius.md, backgroundColor: colors.brandDark, paddingHorizontal: spacing.md, justifyContent: 'center' },
  retryText: { color: '#fff', fontWeight: '800' },
  photoPending: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  photoPendingText: { flex: 1, color: colors.brandDark, fontWeight: '700', fontSize: 13 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.canvas
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  voice: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 }
});
