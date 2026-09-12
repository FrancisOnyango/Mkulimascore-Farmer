import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Caption } from '@/components/Typography';
import { chooseFile, chooseFromGallery, isImageUri, takePhoto, type CapturedFile } from '@/lib/media/capture';
import { colors, radius, spacing } from '@/constants/theme';

export function EvidenceAttach({
  uri,
  name,
  onCaptured,
  onClear
}: {
  uri?: string | null;
  name?: string | null;
  onCaptured: (file: CapturedFile) => void;
  onClear?: () => void;
}) {
  const [busy, setBusy] = useState<'camera' | 'gallery' | 'file' | null>(null);

  async function run(kind: 'camera' | 'gallery' | 'file', action: () => Promise<CapturedFile | null>) {
    if (busy) return;
    setBusy(kind);
    try {
      const file = await action();
      if (file) onCaptured(file);
    } catch {
      Alert.alert(
        kind === 'camera' ? 'Camera could not open' : kind === 'gallery' ? 'Photos could not open' : 'Files could not open',
        'Try again. If this install is older, reinstall the latest Mkulima app.'
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <View>
      <View style={styles.actions}>
        <PrimaryButton label={busy === 'camera' ? 'Opening camera...' : 'Take photo'} variant="secondary" disabled={Boolean(busy)} onPress={() => void run('camera', takePhoto)} />
        <PrimaryButton label={busy === 'gallery' ? 'Opening photos...' : 'Choose from phone'} variant="secondary" disabled={Boolean(busy)} onPress={() => void run('gallery', chooseFromGallery)} />
        <PrimaryButton label={busy === 'file' ? 'Opening files...' : 'Choose a file'} variant="secondary" disabled={Boolean(busy)} onPress={() => void run('file', chooseFile)} />
      </View>
      {uri ? (
        <View style={styles.preview}>
          {isImageUri(uri) ? <Image source={{ uri }} style={styles.image} accessibilityLabel="Selected farm photo" /> : null}
          <Caption>{name || uri.split('/').pop()}</Caption>
          {onClear ? (
            <Text onPress={onClear} style={styles.clear} accessibilityRole="button">Remove</Text>
          ) : null}
        </View>
      ) : (
        <Caption style={{ marginTop: spacing.md }}>Photograph the crop, livestock or receipt, or choose a file already on this phone.</Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
  preview: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: spacing.sm },
  image: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  clear: { color: colors.info, fontWeight: '800' }
});
