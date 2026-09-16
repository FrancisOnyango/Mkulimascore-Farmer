export const colors = {
  brand: '#2F9E5B',
  brandDark: '#146B3A',
  brandSoft: '#E8F6EE',
  ink: '#122018',
  text: '#1F2E27',
  muted: '#5A6B62',
  faint: '#7A8A81',
  line: '#E3EAE5',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F7F4',
  canvas: '#F4F7F5',
  warm: '#FFF4D8',
  warmInk: '#8A5A12',
  success: '#1F8A4D',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#C2410C',
  dangerSoft: '#FFEDD5',
  info: '#0284C7',
  infoSoft: '#E0F2FE',
  water: '#0EA5E9',
  waterSoft: '#E0F7FF',
  clay: '#B45309',
  claySoft: '#FFF7ED',
  dark: '#0B1611'
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40
} as const;

/** Mobile chrome — keep screens, tab bar and FAB aligned. */
export const layout = {
  /** Horizontal inset for phone content (narrower than tablet). */
  screenPad: 16,
  screenPadWide: 20,
  contentMaxWidth: 760,
  /** Tab bar content row (icons + labels), excluding home-indicator inset. */
  tabBarContent: 52,
  tabBarIcon: 22,
  tabBarLabel: 10,
  /** Floating Ask control clearance above the tab bar. */
  fabClearance: 64,
  /** Extra scroll room under tab content when FAB is present. */
  scrollFabExtra: 72,
  /** Minimum scroll padding under tab screens without FAB. */
  scrollTabExtra: 24
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B1A10',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  }
};

export const touch = {
  min: 44
} as const;
