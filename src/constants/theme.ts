export const colors = {
  brand: '#505DC3',
  brandDark: '#2E3561',
  brandSoft: '#EFE4F0',
  brandMist: '#F7F1FA',
  accent: '#9277D1',
  accentSoft: '#ECE6FA',
  ink: '#202542',
  text: '#34395D',
  muted: '#687092',
  faint: '#95A3B8',
  line: '#DDD5E6',
  surface: '#FFFBFF',
  surfaceAlt: '#F5F0F8',
  surfaceGlass: 'rgba(255,255,255,0.72)',
  canvas: '#F2EEF6',
  warm: '#FFF0D7',
  warmInk: '#946018',
  success: '#247A56',
  warning: '#D97706',
  warningSoft: '#FFF0D7',
  danger: '#B94A3B',
  dangerSoft: '#FBE4E1',
  info: '#599BE8',
  infoSoft: '#E7F1FF',
  water: '#599BE8',
  waterSoft: '#E7F1FF',
  clay: '#A15C45',
  claySoft: '#F5E7E2',
  dark: '#171B34',
  midnight: '#10142B'
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
  screenPadCompact: 12,
  /** Horizontal inset for phone content (narrower than tablet). */
  screenPad: 16,
  screenPadWide: 20,
  contentMaxWidth: 820,
  formMaxWidth: 560,
  compactWidth: 360,
  narrowWidth: 390,
  tabletWidth: 768,
  shortHeight: 700,
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
    shadowColor: '#2E3561',
    shadowOpacity: 0.11,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  lift: {
    shadowColor: '#2E3561',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 7
  }
};

export const touch = {
  min: 44,
  comfortable: 48
} as const;
