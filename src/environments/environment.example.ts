// Copy this file to environment.ts (local dev) AND environment.prod.ts (production
// builds — `npm run build` uses the production configuration by default), then fill
// in real values. The real environment.*.ts files are gitignored because they hold
// live API keys. Ask an existing developer for the values, or read the Firebase web
// app config from the Firebase console (project `taliferrotech`).
export const environment = {
    production: false, // true in environment.prod.ts
    useEmulators: false,
    multiTenant: true,
    multiple_choice_login: false,
    COMPANY_NAME: 'TODD',
    LOGO: 'assets/TODD-icon.png',
    paid: false,
    // Where this app is served: http://localhost:4200 locally, https://ask.taliferro.tech in prod.
    PLATFORM_URL: 'http://localhost:4200',
    VERSION: require('../../package.json').version,
    // Firebase console -> taliferrotech -> Project settings -> Your apps -> Web app config.
    firebaseConfig: {
        apiKey: 'FIREBASE_API_KEY',
        authDomain: 'taliferrotech.firebaseapp.com',
        projectId: 'taliferrotech',
        storageBucket: 'taliferrotech.appspot.com',
        messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
        appId: 'FIREBASE_APP_ID',
        measurementId: 'FIREBASE_MEASUREMENT_ID',
    },
    // Google Cloud API key used by a few shared services (separate from firebaseConfig.apiKey).
    apiKey: 'GOOGLE_API_KEY',
    googleMapsApiKey: 'GOOGLE_MAPS_API_KEY',
    RECAPTCHA_KEY: 'RECAPTCHA_SITE_KEY',
    linkPreview: 'LINK_PREVIEW_API_KEY',
    // Locally, '/api' goes through src/proxy.conf.json to the PRODUCTION backend
    // (https://api.taliferro.tech). In environment.prod.ts use 'https://api.taliferro.tech/api'.
    backendURL: '/api',
    accessCode: 'ACCESS_CODE',
    // UID of the Taliferro tenant account: owns shared data and marks admin users.
    taliferroTenantId: 'TALIFERRO_TENANT_UID',
    stripeTestMode: true,
    enableAnonymousBehaviorTracking: true,
    enableCustomInstallPrompt: false,
    topMenu: true,
    homePage: '/',
    startPage: '/',
    memberPage: '/',
};
