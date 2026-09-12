import { Alert, Linking } from 'react-native';

export type CapturedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  kind: 'camera' | 'gallery' | 'file';
};

function fileName(uri: string, fallback = 'farm-record') {
  const last = uri.split('/').pop() ?? fallback;
  return decodeURIComponent(last.split('?')[0] || fallback);
}

function explainDenied(kind: 'camera' | 'photos') {
  Alert.alert(
    kind === 'camera' ? 'Camera permission' : 'Photos permission',
    kind === 'camera'
      ? 'Allow the camera only when you want to photograph a farm record.'
      : 'Allow photos only when you want to attach a picture already on this phone.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => void Linking.openSettings() }
    ]
  );
}

export async function takePhoto(): Promise<CapturedFile | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    explainDenied('camera');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.78,
    allowsEditing: false,
    exif: false
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, name: asset.fileName || fileName(asset.uri, 'camera-photo.jpg'), mimeType: asset.mimeType, kind: 'camera' };
}

export async function chooseFromGallery(): Promise<CapturedFile | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    explainDenied('photos');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.78,
    allowsMultipleSelection: false,
    exif: false
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, name: asset.fileName || fileName(asset.uri, 'phone-photo.jpg'), mimeType: asset.mimeType, kind: 'gallery' };
}

export async function chooseFile(): Promise<CapturedFile | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, name: asset.name || fileName(asset.uri, 'farm-file'), mimeType: asset.mimeType, kind: 'file' };
}

export function isImageUri(uri?: string | null, mimeType?: string | null) {
  if (mimeType?.startsWith('image/')) return true;
  return Boolean(uri && /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(uri.split('?')[0] ?? ''));
}
