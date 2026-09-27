import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
    initializeApp({
        credential: cert(
            JSON.parse(process.env.FIREBASE_PRIVATE_KEY as string)
        ),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

export const firebaseAdminDB = getFirestore();

// Realtime Database
export const firebaseAdminDBRealTime = getDatabase();

// Auth
export const auth = getAuth();