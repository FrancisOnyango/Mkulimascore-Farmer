import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout } from '@/constants/theme';

/** Shared mobile chrome metrics for tabs, AppShell and FAB. */
export function useMobileLayout() {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale, scale } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const compact = width < layout.compactWidth;
  const narrow = width < layout.narrowWidth;
  const tablet = shortestSide >= layout.tabletWidth;
  const short = height < layout.shortHeight;
  const tabBottomInset = Math.max(insets.bottom, 6);
  const tabBarHeight = layout.tabBarContent + tabBottomInset + (fontScale > 1.15 ? 4 : 0);
  const basePad = tablet ? layout.screenPadWide : compact ? layout.screenPadCompact : layout.screenPad;
  const screenPad = basePad;
  return {
    insets,
    width,
    height,
    scale,
    fontScale,
    compact,
    narrow,
    tablet,
    short,
    isLandscape: width > height,
    screenPad,
    tabBottomInset,
    tabBarHeight,
    fabBottom: 10,
    scrollBottom: (withFab: boolean) =>
      (withFab ? layout.scrollFabExtra : layout.scrollTabExtra) + (compact ? 8 : 0)
  };
}
