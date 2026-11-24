// Lazy-load Firebase Admin — ESM deps (jose/jwks-rsa) Node 18 CJS-e crash kore,
// tai Firebase optional thakle startup-e import hobe na.

type DecodedIdToken = {
  phone_number?: string;
  [key: string]: unknown;
};

type FirebaseAuth = {
  verifyIdToken: (token: string) => Promise<DecodedIdToken>;
};

let auth: FirebaseAuth | null = null;
let initTried = false;

function initFirebase(): FirebaseAuth | null {
  if (auth) return auth;
  if (initTried) return null;
  initTried = true;

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.warn('FIREBASE_SERVICE_ACCOUNT is not set. Firebase Admin SDK will not initialize.');
      return null;
    }

    // require() Node 18-e ESM package crash kore — only configured holei load
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth } = require('firebase-admin/auth');

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
      console.log('Firebase Admin SDK initialized successfully.');
    }
    auth = getAuth();
    return auth;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

export function getAuth(): FirebaseAuth {
  const a = initFirebase();
  if (!a) {
    throw new Error('Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT or use OTP login.');
  }
  return a;
}
