/**
 * Firebase Admin SDK initialization - Server Side Only
 * 
 * This file should only be imported in server components or API routes.
 * Never import this file in client components.
 */

// Using import statements with 'server-only' package ensures this file is never used in client components
import 'server-only';

import { 
  initializeApp as initializeAdminApp, 
  getApps as getAdminApps, 
  cert 
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

type FirebaseAdminApp = ReturnType<typeof initializeAdminApp>;
let adminApp: FirebaseAdminApp | undefined;

/**
 * Initialize Firebase Admin for server-side operations
 * This should only be called from server-side code
 */
export function initializeFirebaseAdmin() {
  if (!getAdminApps().length) {
    try {
      const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        adminApp = initializeAdminApp({
          credential: cert(serviceAccount),
        });
        console.log('Firebase Admin initialized successfully using FIREBASE_ADMIN_CREDENTIALS_JSON.');
      } else {
        console.error('FIREBASE_ADMIN_CREDENTIALS_JSON is not set in environment variables. Attempting default initialization.');
        adminApp = initializeAdminApp();
        console.log('Attempted Firebase Admin initialization without explicit credentials.');
      }
    } catch (error: any) {
      console.error('Error initializing Firebase Admin:', error.message ? error.message : error);
    }
  } else {
    adminApp = getAdminApps()[0];
  }
  
  return adminApp;
}

/**
 * Get Firebase Admin Firestore instance
 * Must call initializeFirebaseAdmin() first
 */
export function getAdminDb() {
  if (!adminApp) {
    initializeFirebaseAdmin(); // Ensure it's initialized if not already
    if (!adminApp) { // Check again after attempting initialization
        throw new Error('Firebase Admin could not be initialized.');
    }
  }
  
  return getAdminFirestore();
}

/**
 * Get Firebase Admin Auth instance
 * Must call initializeFirebaseAdmin() first
 */
export function getFirebaseAdminAuth() {
  if (!adminApp) {
    initializeFirebaseAdmin(); // Ensure it's initialized if not already
    if (!adminApp) { // Check again after attempting initialization
        throw new Error('Firebase Admin could not be initialized.');
    }
  }
  
  return getAdminAuth();
}
