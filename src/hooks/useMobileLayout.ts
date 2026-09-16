import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout } from '@/constants/theme';

/** Shared mobile chrome metrics for tabs, AppShell and FAB. */
export function useMobileLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const narrow = width < 390;
  const tabBottomInset = Math.max(insets.bottom, 6);
  const tabBarHeight = layout.tabBarContent + tabBottomInset;
  const screenPad = width >= 768 ? layout.screenPadWide : layout.screenPad;
  return {
    insets,
    width,
    narrow,
    screenPad,
    tabBottomInset,
    tabBarHeight,
    fabBottom: 10,
    scrollBottom: (withFab: boolean) =>
      (withFab ? layout.scrollFabExtra : layout.scrollTabExtra) + (narrow ? 8 : 0)
  };
}
