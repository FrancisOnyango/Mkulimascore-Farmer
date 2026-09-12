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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { BrandMark } from '@/components/BrandMark';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';
import { startVoiceInput } from '@/lib/voice/voiceInput';
import { getAskMkulimaIntegrationStatus, type AskMkulimaIntegrationStatus } from '@/lib/ai/AskMkulimaIntegration';
import type { AskMkulimaMessage } from '@/domain/types';

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
  if (enterprises.length) suggestions.push('How is my production?');
  if (records.some((record) => /cost|expense/i.test(`${record.category} ${record.title}`))) suggestions.push('What have I spent?');
  if (requests.some((request) => request.status === 'open')) suggestions.push('What record is still needed?');
  if (farms.some((farm) => !farm.mapped)) suggestions.push('Is my farm mapped?');
  if (insights.some((insight) => insight.tone === 'attention')) suggestions.push('What should I do first?');
  if (outbox.some((item) => item.state !== 'SYNCED')) suggestions.push('What is still waiting to send?');
  if (suggestions.length === 0) suggestions.push('What should I do first?');
  return [...new Set(suggestions)].slice(0, 4);
}

export default function AskMkulima() {
  const {
    askMessages,
    askMkulima,
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
  const starters = useMemo(
    () => getContextualStarters({ weather, markets, requests, farms, enterprises, records, insights, outbox }),
    [enterprises, farms, insights, markets, outbox, records, requests, weather]
  );
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState('');
  const [openedSource, setOpenedSource] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
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
    };
  }, []);

  async function send(text = question) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setQuestion('');
    try {
      await askMkulima(trimmed);
      setFailedQuestion('');
    } catch (sendError) {
      setQuestion(trimmed);
      setFailedQuestion(trimmed);
      const code = sendError instanceof Error ? sendError.message : '';
      setError(
        code === 'ASK_MKULIMA_RATE_LIMITED'
          ? 'The assistant is busy. Wait a moment, then try again.'
          : code === 'ASK_MKULIMA_TIMEOUT'
            ? 'That took too long. Your farm data is still safe.'
            : code === 'AUTH_REQUIRED'
              ? 'Sign in again if you want the live assistant. You can still ask from this phone.'
              : 'I could not answer that. Your farm data is still safe. Try again when you have a signal.'
      );
    } finally {
      setSending(false);
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
      Alert.alert('Voice', 'Voice is not available here. Type your question.');
    } finally {
      setListening(false);
    }
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
            <Text style={styles.title}>Ask Mkulima</Text>
            <Text style={styles.status}>
              {!ready ? 'Opening your farm book…' : offline ? 'On this phone' : integrationLabel(integration)}
            </Text>
          </View>
          {askMessages.length ? (
            <Pressable onPress={() => void clearAskConversation()} accessibilityRole="button" accessibilityLabel="Clear conversation" style={styles.iconBtn}>
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
              <Text style={styles.emptyTitle}>Ask about this farm</Text>
              <Text style={styles.emptyBody}>I use what you saved on this phone. I will not invent a price or promise a loan.</Text>
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
              onToggleSource={() => setOpenedSource((current) => (current === item.id ? null : item.id))}
              onFollowUp={(followUp) => void send(followUp)}
            />
          )}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <BrandMark size={28} />
                <View style={styles.typingBubble}>
                  <ActivityIndicator color={colors.brand} size="small" />
                  <Text style={styles.typingText}>Looking at your farm book…</Text>
                </View>
              </View>
            ) : null
          }
        />

        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void send(failedQuestion)} disabled={!failedQuestion || sending} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about your farm"
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
            disabled={sending || !question.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, (sending || !question.trim()) && styles.disabled]}
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
  onToggleSource,
  onFollowUp
}: {
  message: AskMkulimaMessage;
  last: boolean;
  sending: boolean;
  opened: boolean;
  onToggleSource: () => void;
  onFollowUp: (text: string) => void;
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
        {localOnly ? <Text style={styles.fromPhone}>From this phone</Text> : null}
        {sources.length ? (
          <Pressable onPress={onToggleSource} accessibilityRole="button" style={styles.how}>
            <Text style={styles.howText}>{opened ? 'Hide how I know' : 'How I know'}</Text>
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
        {last && message.metadata?.followUps.length && !sending ? (
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

function integrationLabel(status: AskMkulimaIntegrationStatus | null) {
  if (!status) return 'Opening…';
  if (status.state === 'ready') return 'Live · your farm records';
  if (status.state === 'auth_required') return 'On this phone · sign in for live';
  return 'On this phone';
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
  fromPhone: { color: colors.faint, fontSize: 11, fontWeight: '700', marginTop: spacing.sm },
  how: { marginTop: spacing.sm },
  howText: { color: colors.brand, fontWeight: '800', fontSize: 12 },
  sourceBox: { marginTop: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  sourceLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  inlineFollow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
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
