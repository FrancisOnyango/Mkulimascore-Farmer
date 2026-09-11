import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => BrowserRecognition;

export async function startVoiceInput(language: 'en' | 'sw'): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new Error('VOICE_INPUT_NATIVE_BACKEND_REQUIRED');
  }
  const Recognition = (globalThis as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
    ?? (globalThis as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
  if (!Recognition) throw new Error('VOICE_INPUT_UNSUPPORTED');
  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = language === 'sw' ? 'sw-KE' : 'en-KE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => resolve(event.results[0]?.[0]?.transcript ?? '');
    recognition.onerror = () => reject(new Error('VOICE_INPUT_FAILED'));
    recognition.onend = () => undefined;
    recognition.start();
  });
}

export function speakAnswer(text: string, language: 'en' | 'sw') {
  Speech.stop();
  Speech.speak(text, { language: language === 'sw' ? 'sw-KE' : 'en-KE', rate: 0.9 });
}
