export const colors = {
  brand: '#17643B',
  brandDark: '#0D2F21',
  brandSoft: '#E7F2EC',
  ink: '#132019',
  text: '#24332B',
  muted: '#3F4F47',
  faint: '#5C6B63',
  line: '#D6DCD4',
  surface: '#FFFdf8',
  surfaceAlt: '#EFEADF',
  canvas: '#F5F3EA',
  warm: '#F3E4C0',
  warmInk: '#5A3D12',
  success: '#1F6B40',
  warning: '#9A5A12',
  danger: '#9A3330',
  info: '#2F618D',
  infoSoft: '#E6EEF6',
  clay: '#A6543F',
  claySoft: '#F5E6E1',
  dark: '#0B1611'
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
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

export const shadow = {
  card: {
    shadowColor: '#0B1A10',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  }
};

export const touch = {
  min: 48
} as const;
