import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Body, Caption, Eyebrow, H2 } from '@/components/Typography';
import { Card } from '@/components/Card';
import { useAppData } from '@/context/AppDataContext';
import { colors, radius, spacing } from '@/constants/theme';
import { speakAnswer, startVoiceInput } from '@/lib/voice/voiceInput';
import { getAskMkulimaIntegrationStatus, type AskMkulimaIntegrationStatus } from '@/lib/ai/AskMkulimaIntegration';
import { Ionicons } from '@expo/vector-icons';

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
  if (weather.length) suggestions.push("What should I do about today's weather?");
  if (markets.length) suggestions.push('What is my latest market price?');
  if (enterprises.length) suggestions.push('How is my production looking?');
  if (records.some((record) => /cost|expense/i.test(`${record.category} ${record.title}`))) suggestions.push('What do my costs tell me?');
  if (requests.some((request) => request.status === 'open')) suggestions.push('Which record should I upload next?');
  if (farms.some((farm) => !farm.mapped)) suggestions.push('What does farm mapped mean?');
  if (insights.some((insight) => insight.tone === 'attention')) suggestions.push('What is the most important action for my farm?');
  if (outbox.some((item) => item.state !== 'SYNCED')) suggestions.push('What is waiting to sync?');
  if (suggestions.length === 0) suggestions.push('What should I update first?');
  return [...new Set(suggestions)].slice(0, 6);
}

export default function AskMkulima() {
  const { askMessages, askMkulima, deleteAskMessage, clearAskConversation, settings, weather, markets, requests, farms, enterprises, records, insights, outbox, offline, ready } = useAppData();
  const starters = useMemo(() => getContextualStarters({ weather, markets, requests, farms, enterprises, records, insights, outbox }), [enterprises, farms, insights, markets, outbox, records, requests, weather]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [listening, setListening] = useState(false);
  const [integration, setIntegration] = useState<AskMkulimaIntegrationStatus | null>(null);
  const visibleMessages = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? askMessages.filter((message) => message.text.toLocaleLowerCase().includes(term)) : askMessages;
  }, [askMessages, search]);

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
      setError(code === 'ASK_MKULIMA_RATE_LIMITED'
        ? 'The assistant is busy. Please wait a moment and retry.'
        : code === 'ASK_MKULIMA_TIMEOUT'
          ? 'The assistant took too long to respond. Your saved data is safe; retry when connected.'
          : code === 'AUTH_REQUIRED'
            ? 'Please sign in again before using the live assistant. Saved farm data remains available.'
            : 'Your question could not be answered. Saved farm data is still safe. Check your connection or retry the same question.');
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
    } catch (voiceError) {
      const message = voiceError instanceof Error && voiceError.message === 'VOICE_INPUT_NATIVE_BACKEND_REQUIRED'
        ? 'Voice input on Android/iOS needs the production transcription integration. You can still type your question.'
        : 'Voice input is not available in this browser or permission was denied.';
      Alert.alert('Voice input', message);
    } finally {
      setListening(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppShell>
        <View style={styles.aiHeader}>
          <Eyebrow style={styles.headerEyebrow}>{settings.language === 'sw' ? 'AI salama kwa mkulima' : 'Farmer-safe AI'}</Eyebrow>
          <H2 style={styles.aiTitle}>Ask Mkulima</H2>
          <Body style={styles.aiLead}>{settings.language === 'sw' ? 'Uliza kuhusu shamba, hali ya hewa, masoko, uzalishaji, gharama au hatua inayofuata.' : 'Ask about your farm, weather, markets, production, costs, records or next action. Answers use only farmer-safe data available on this phone unless a clearly labelled service response is returned.'}</Body>
        </View>

        <View style={styles.stateRow} accessibilityRole="text">
          <Text style={styles.stateText}>{!ready ? 'Loading saved farm context...' : offline ? 'Offline: answering from saved data' : integrationLabel(integration)}</Text>
        </View>

        {askMessages.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Body style={styles.empty}>I can explain what is already on this phone — weather, records, production and next steps. I will not invent live prices, promise a loan, or reveal scoring rules.</Body>
          </Card>
        ) : null}

        <View style={styles.starters} accessibilityLabel="Suggested questions">
          {starters.map((starter) => (
            <Pressable
              key={starter}
              onPress={() => void send(starter)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={`Ask: ${starter}`}
              accessibilityState={{ disabled: sending }}
              style={[styles.starter, sending && styles.disabled]}
            >
              <Text style={styles.starterText}>{starter}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.messages} accessibilityLiveRegion="polite">
          {visibleMessages.map((message) => (
            <View key={message.id} style={[styles.bubble, message.role === 'farmer' ? styles.farmerBubble : styles.assistantBubble]}>
              <Text style={[styles.messageText, message.role === 'farmer' && styles.farmerText]}>{message.text}</Text>
              <Caption style={message.role === 'farmer' ? styles.farmerCaption : styles.assistantCaption}>{message.role === 'farmer' ? 'You' : 'Ask Mkulima'}</Caption>
              {message.role === 'assistant' && message.metadata ? (
                <View style={styles.metadata}>
                  <View style={styles.metadataActionRow}>
                    <Text style={styles.metadataText}>Confidence: {message.metadata.confidence}</Text>
                    <Pressable onPress={() => speakAnswer(message.text, settings.language)} accessibilityRole="button" style={styles.smallAction}>
                      <Ionicons name="volume-medium-outline" size={18} color={colors.brandDark} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => setExpandedSources((current) => ({ ...current, [message.id]: !current[message.id] }))} accessibilityRole="button" style={styles.sourcesToggle}>
                    <Text style={styles.metadataHeading}>{expandedSources[message.id] ? 'Hide' : 'Show'} how this answer was formed</Text>
                  </Pressable>
                  {expandedSources[message.id] ? (
                    <View style={styles.sourceList}>
                      {message.metadata.sources.map((source) => <Text key={`${message.id}-${source.label}`} style={styles.metadataText}>- {source.label} / {source.freshness}{source.limitation ? ` - ${source.limitation}` : ''}</Text>)}
                    </View>
                  ) : null}
                  {message.metadata.sources.length ? (
                    <Text style={styles.metadataText}>Source & freshness: {message.metadata.sources.map((source) => `${source.label} / ${source.freshness}`).join('; ')}</Text>
                  ) : null}
                  {message.metadata.recommendations.length ? (
                    <View style={styles.recommendations}>
                      <Text style={styles.metadataHeading}>Suggested next steps</Text>
                      {message.metadata.recommendations.map((recommendation) => <Text key={recommendation} style={styles.metadataText}>- {recommendation}</Text>)}
                    </View>
                  ) : null}
                  <Pressable onPress={() => void deleteAskMessage(message.id)} accessibilityRole="button" style={styles.deleteMessage}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                  {message.metadata.limitations.length ? <Text style={styles.metadataText}>Limitations: {message.metadata.limitations.join(' ')}</Text> : null}
                  {message.metadata.followUps.length ? (
                    <View style={styles.followUps}>
                      <Text style={styles.metadataHeading}>Ask next</Text>
                      {message.metadata.followUps.map((followUp) => (
                        <Pressable key={followUp} onPress={() => void send(followUp)} disabled={sending} accessibilityRole="button" accessibilityLabel={`Ask follow-up: ${followUp}`} style={styles.followUp}>
                          <Text style={styles.followUpText}>{followUp}</Text>
                        </Pressable>
                      ))}
                    </View>

                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.conversationTools}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search this conversation" placeholderTextColor={colors.faint} style={styles.searchInput} accessibilityLabel="Search conversation" />
          {askMessages.length ? (
            <Pressable onPress={() => void clearAskConversation()} accessibilityRole="button" accessibilityLabel="Delete all messages" style={styles.clearButton}>
              <Ionicons name="trash-bin-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>

        {sending ? (
          <View style={styles.loading} accessibilityLiveRegion="polite" accessibilityLabel="Ask Mkulima is preparing an answer">
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Checking saved farm context...</Text>
          </View>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void send(failedQuestion)} disabled={!failedQuestion || sending} accessibilityRole="button" accessibilityLabel="Retry question" style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Card>
        ) : null}

        <View style={styles.inputWrap}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about your farm..."
            placeholderTextColor={colors.faint}
            multiline
            maxLength={500}
            editable={!sending}
            accessibilityLabel="Question for Ask Mkulima"
            accessibilityHint="Type a question about your saved farm data"
            style={styles.input}
          />
          <Pressable onPress={() => void listen()} disabled={sending || listening} accessibilityRole="button" accessibilityLabel="Use voice input" style={[styles.voice, (sending || listening) && styles.disabled]}>
            {listening ? <ActivityIndicator color={colors.brandDark} /> : <Ionicons name="mic-outline" size={22} color={colors.brandDark} />}
          </Pressable>
          <Pressable onPress={() => void send()} disabled={sending || !question.trim()} accessibilityRole="button" accessibilityLabel={sending ? 'Sending question' : 'Send question'} accessibilityState={{ disabled: sending || !question.trim() }} style={[styles.send, (sending || !question.trim()) && styles.disabled]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </Pressable>
        </View>
        <Caption style={styles.note}>Informational only: no lending decision, approval guarantee, institution-only score, or fabricated live claim. Check the source, freshness and limitation notes before acting.</Caption>
      </AppShell>
    </KeyboardAvoidingView>
  );
}

function integrationLabel(status: AskMkulimaIntegrationStatus | null) {
  if (!status) return 'Checking Ask Mkulima service...';
  if (status.state === 'ready') return 'Live assistant: using farmer-safe farm context';
  if (status.state === 'auth_required') return 'Live assistant needs sign in. You can still ask from saved data.';
  if (status.state === 'misconfigured') return 'AI not configured; answering from this phone';
  if (status.state === 'unavailable') return 'Live assistant unavailable: answering from this phone';
  return 'Answering from farmer-safe data on this phone';
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  aiHeader: { backgroundColor: colors.brandDark, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.brandDark },
  headerEyebrow: { color: '#D8E8DE' },
  aiTitle: { color: '#fff', marginTop: spacing.sm },
  aiLead: { color: '#EEF7F1', marginTop: spacing.sm },
  stateRow: { marginTop: spacing.md, paddingHorizontal: spacing.sm },
  stateText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  emptyCard: { marginTop: spacing.md, backgroundColor: colors.infoSoft, borderColor: '#C9D9E8' },
  empty: { color: colors.info, fontWeight: '800' },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  starter: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  starterText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  messages: { gap: spacing.md, marginTop: spacing.xl },
  bubble: { maxWidth: '96%', borderRadius: radius.lg, padding: spacing.lg },
  farmerBubble: { alignSelf: 'flex-end', backgroundColor: colors.brandDark },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  farmerText: { color: '#fff' },
  farmerCaption: { color: '#D8E8DE', marginTop: spacing.sm },
  assistantCaption: { marginTop: spacing.sm },
  metadata: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  metadataActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallAction: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { color: colors.brand, fontWeight: '800', fontSize: 12 },
  sourcesToggle: { paddingVertical: spacing.xs },
  sourceList: { gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm },
  metadataHeading: { color: colors.brandDark, fontWeight: '900', fontSize: 12 },
  metadataText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  recommendations: { gap: spacing.xs },
  followUps: { gap: spacing.xs, marginTop: spacing.xs },
  followUp: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, paddingHorizontal: spacing.md, justifyContent: 'center' },
  followUpText: { color: colors.brandDark, fontWeight: '800', fontSize: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  loadingText: { color: colors.muted, fontSize: 13 },
  errorCard: { marginTop: spacing.lg, backgroundColor: colors.claySoft, borderColor: '#E7C8BF', flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  errorText: { flex: 1, color: colors.clay, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  retry: { minHeight: 40, borderRadius: radius.md, backgroundColor: colors.brandDark, paddingHorizontal: spacing.md, justifyContent: 'center' },
  retryText: { color: '#fff', fontWeight: '900' },
  deleteMessage: { alignSelf: 'flex-end', marginTop: spacing.sm },
  deleteText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  conversationTools: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.lg },
  searchInput: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text },
  clearButton: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.xxl },
  input: { flex: 1, minHeight: 52, maxHeight: 120, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 16, color: colors.text },
  send: { minHeight: 52, minWidth: 56, borderRadius: radius.lg, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '900' },
  voice: { minHeight: 52, minWidth: 44, borderRadius: radius.lg, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 18 },
  note: { marginTop: spacing.lg, textAlign: 'center' }
});


