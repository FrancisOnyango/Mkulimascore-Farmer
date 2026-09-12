import type { AppSettings } from '@/domain/types';

export const strings = {
  appName: 'Mkulima',
  passport: 'Mkulima Passport',
  readinessReady: 'Ready for assessment',
  readinessAttention: 'Needs attention',
  tabs: {
    home: 'Home',
    farm: 'My Farm',
    activity: 'Activity',
    insights: 'Insights',
    profile: 'Profile'
  },
  welcome: {
    line1: 'Your farm.',
    line2: 'Your records.',
    line3: 'Your Mkulima Passport.',
    support: 'Keep your farm information in one place and receive useful insights based on your farm, location and activity.',
    start: 'Get started',
    signIn: 'I already have an account',
    kenya: 'Kenya',
    brand: 'Mkulima',
    brandLine: 'Know your farm · useful intelligence · your Passport.',
    saved: 'Understand your farm',
    control: 'Find useful market and weather intelligence',
    noLoan: 'Build a stronger agricultural profile',
    trialTitle: 'Try the sample farm',
    trialBody: 'No SMS needed. This is a practice farm, not a real person.',
    trialAction: 'Open sample farm',
    trialPhone: 'Phone',
    trialCode: 'Code'
  },
  consent: {
    title: 'Your information, your control',
    body: 'Your information helps us build your Mkulima Passport and provide relevant farm and financial insights.',
    collected: 'We collect your name, phone, farm location, enterprises and the records you choose to add.',
    why: 'This helps you keep a lasting farm history and, only with your permission, support assessment by participating institutions.',
    who: 'Mkulima keeps your Passport. Sharing with a SACCO, cooperative or lender always requires your consent.',
    manage: 'You can review and change sharing later in Profile.',
    learnMore: 'Learn more',
    accept: 'I understand and continue',
    versionLabel: 'Consent version'
  },
  identity: {
    title: 'Who is this Passport for?',
    body: 'Only the details we need to start. You can add more later.',
    name: 'Your name',
    county: 'County',
    language: 'Preferred language',
    yearOfBirth: 'Year of birth, optional',
    nationalId: 'National ID, optional'
  },
  farmOnboarding: {
    title: 'Add your farm',
    body: 'A location is enough to start. You do not need to draw a boundary yet.',
    useLocation: 'Use my current location',
    search: 'Search location',
    later: 'Add location later',
    found: 'We found your location',
    confirm: 'Use this location',
    name: 'Farm name, optional',
    area: 'Approximate area',
    tenure: 'How you use this land'
  },
  sync: {
    saved: 'Saved on this phone',
    willSync: 'Will sync when you are online',
    synced: 'Synced',
    syncing: 'Syncing',
    attention: 'Needs attention'
  },
  empty: {
    activity: 'No production records yet',
    activityBody: 'Add milk, harvest, eggs or a sale.',
    addActivity: 'Add activity'
  },
  help: {
    passport: 'What is Mkulima Passport?',
    passportAnswer: 'It is your farm identity and history in one place — who you are, where you farm, what you produce, and which records have been confirmed.',
    why: 'Why do you need my farm information?',
    whyAnswer: 'So your farm history does not disappear every season, and so useful local information can be tied to your place and enterprises.',
    who: 'Who can see my data?',
    whoAnswer: 'You see it. Mkulima keeps it to run the app. A SACCO, cooperative or lender only sees what you choose to share.',
    loan: 'Does this guarantee a loan?',
    loanAnswer: 'No. Participating institutions make their own decisions. A complete Passport can support assessment when you share it. It does not guarantee credit.',
    verified: 'How is my information verified?',
    verifiedAnswer: 'You add information yourself. A cooperative or field visit may later confirm it. Until then it is simply marked as added by you.'
  },
  settings: {
    title: 'Settings',
    lowDataMode: 'Low-data mode',
    language: 'Language',
    english: 'English',
    kiswahiliReadiness: 'Kiswahili readiness',
    backendMode: 'Backend mode',
    apiBase: 'API base',
    health: 'Health',
    refreshBackend: 'Refresh backend status'
  },
  disclaimer: 'Your farm information can support assessment by participating financial institutions when you choose to share it. Mkulima does not guarantee a loan.'
};

export const swahiliStrings = {
  ...strings,
  passport: 'Pasipoti ya Mkulima',
  readinessReady: 'Tayari kwa tathmini',
  readinessAttention: 'Inahitaji uangalizi',
  tabs: {
    home: 'Nyumbani',
    farm: 'Shamba',
    activity: 'Shughuli',
    insights: 'Ufahamu',
    profile: 'Wasifu'
  },
  identity: {
    ...strings.identity,
    title: 'Pasipoti hii ni ya nani?',
    body: 'Maelezo ya kuanzia tu. Unaweza kuongeza mengine baadaye.',
    name: 'Jina lako',
    county: 'Kaunti',
    language: 'Lugha unayopendelea',
    yearOfBirth: 'Mwaka wa kuzaliwa, si lazima',
    nationalId: 'Kitambulisho, si lazima'
  },
  settings: {
    ...strings.settings,
    title: 'Mipangilio',
    lowDataMode: 'Matumizi kidogo ya data',
    language: 'Lugha',
    english: 'Kiingereza',
    kiswahiliReadiness: 'Kiswahili kiko tayari',
    backendMode: 'Hali ya seva',
    apiBase: 'Msingi wa API',
    health: 'Afya ya seva',
    refreshBackend: 'Angalia seva tena'
  },
  disclaimer: 'Taarifa za shamba zinaweza kusaidia tathmini ya taasisi unapochagua kushiriki. Mkulima haahidi mkopo.'
};

export function getStrings(language: AppSettings['language']) {
  return language === 'sw' ? swahiliStrings : strings;
}
