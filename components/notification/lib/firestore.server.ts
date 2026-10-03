/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * The one way the notification server code reaches Firestore. firebase-admin initialises (and
 * throws on bad credentials) as soon as it is imported, so it is loaded lazily: a misconfigured
 * environment must not break every route that merely imports a notification module, only the call
 * that actually needs Firestore — see sendNotification.ts.
 */
import type { Firestore } from 'firebase-admin/firestore';

export async function firestore(): Promise<Firestore> {
    const { firebaseAdminDB } = await import('@/lib/config/firebase-admin');
    return firebaseAdminDB;
}
