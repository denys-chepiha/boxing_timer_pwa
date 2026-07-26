export type ThemeColors = {
  background: string;
  backgroundElevated: string;
  card: string;
  cardStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primarySoft: string;
  primaryText: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  input: string;
  overlay: string;
  shadow: string;
};

export type AppTheme = {
  isDark: boolean;
  colors: ThemeColors;
};

export const lightTheme: AppTheme = {
  isDark: false,
  colors: {
    background: '#F3F5F9',
    backgroundElevated: '#E9EDF4',
    card: '#FFFFFF',
    cardStrong: '#F9FAFC',
    text: '#151820',
    textMuted: '#5E6574',
    textSubtle: '#687181',
    primary: '#2858E6',
    primarySoft: '#E8EDFF',
    primaryText: '#FFFFFF',
    border: '#DDE1E9',
    borderStrong: '#BEC5D2',
    danger: '#D93F58',
    dangerSoft: '#FDE8EC',
    success: '#13845D',
    successSoft: '#DFF4EA',
    warning: '#A86812',
    warningSoft: '#FAEECF',
    surface: '#F6F7FA',
    surfaceStrong: '#ECEFF4',
    surfaceMuted: '#DDE2EA',
    input: '#FFFFFF',
    overlay: 'rgba(10, 13, 22, 0.62)',
    shadow: '0 18px 48px rgba(21, 24, 32, 0.12)',
  },
};

export const darkTheme: AppTheme = {
  isDark: true,
  colors: {
    background: '#0D0F14',
    backgroundElevated: '#14171F',
    card: '#181B23',
    cardStrong: '#1D212B',
    text: '#F7F8FA',
    textMuted: '#B2B8C4',
    textSubtle: '#858E9F',
    primary: '#7B9CFF',
    primarySoft: '#202D59',
    primaryText: '#081129',
    border: '#2B303C',
    borderStrong: '#454D5D',
    danger: '#FF6A7F',
    dangerSoft: '#431B24',
    success: '#43D29A',
    successSoft: '#17372C',
    warning: '#F4BD58',
    warningSoft: '#3E2D14',
    surface: '#12151C',
    surfaceStrong: '#232833',
    surfaceMuted: '#303745',
    input: '#11141B',
    overlay: 'rgba(2, 4, 9, 0.78)',
    shadow: '0 24px 72px rgba(0, 0, 0, 0.42)',
  },
};
