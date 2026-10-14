import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    startAt,
    where,
    type DocumentData,
    type DocumentSnapshot,
    type Query,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import type { Listener, MessageSource, PageRequest, SourceDoc, Subscription } from "./messageStore";

/** Firestore resumes a query from a snapshot of the exact message, which also settles ties between equal times. */
export type FirestoreHandle = DocumentSnapshot<DocumentData>;
type Handle = FirestoreHandle;

function toSourceDoc(snapshot: QueryDocumentSnapshot<DocumentData>): SourceDoc<Handle> {
    const data = snapshot.data();
    return { id: snapshot.id, time: typeof data.time === "string" ? data.time : "", data, handle: snapshot };
}

/**
 * Listens to a query and resolves `ready` with the first answer that came from the SERVER.
 *
 * Two details make this safe to wait on:
 *  - `includeMetadataChanges` makes Firestore announce "the server has confirmed this" even when the data is
 *    identical to what the cache already held. Without it, an answer that matches the cache raises no second event,
 *    and a caller waiting for the server's word would wait forever.
 *  - Later events carry the full current answer, but only when documents actually changed (metadata-only changes
 *    such as "no longer from cache" are not news to anyone).
 */
function subscribe(
    source: Query<DocumentData>,
    listener: Listener<Handle>,
    chronological: (docs: SourceDoc<Handle>[]) => SourceDoc<Handle>[]
): Subscription<Handle> {
    let settled = false;
    let stopped = false;
    let resolve!: (docs: SourceDoc<Handle>[]) => void;
    let reject!: (error: unknown) => void;
    const ready = new Promise<SourceDoc<Handle>[]>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    // Callers that don't wait for the first answer must not end up with an unhandled rejection.
    ready.catch(() => undefined);

    const unsubscribe = onSnapshot(
        source,
        { includeMetadataChanges: true },
        (snapshot) => {
            if (stopped) return;
            if (!settled) {
                if (snapshot.metadata.fromCache) return; // not the server's word yet; it follows
                settled = true;
                resolve(chronological(snapshot.docs.map(toSourceDoc)));
                return;
            }
            if (snapshot.docChanges().length === 0) return;
            listener.onChange(chronological(snapshot.docs.map(toSourceDoc)));
        },
        (error) => {
            if (stopped) return;
            if (!settled) {
                settled = true;
                reject(error);
            } else {
                listener.onError(error);
            }
        }
    );

    return {
        ready,
        stop() {
            stopped = true;
            unsubscribe();
        },
    };
}

/** The messages of one chat, read the way the message store needs them. `clearedAt` hides what the user cleared. */
export function createFirestoreMessageSource(chatId: string, clearedAt: string | null): MessageSource<Handle> {
    const messagesRef = collection(firebaseClientDB, "chats", chatId, "messages");
    const bounds: QueryConstraint[] = clearedAt ? [where("time", ">", clearedAt)] : [];
    const oldestFirst = (docs: SourceDoc<Handle>[]) => docs;
    const reverse = (docs: SourceDoc<Handle>[]) => docs.slice().reverse();

    return {
        async newest(count) {
            const snapshot = await getDocs(query(messagesRef, ...bounds, orderBy("time", "desc"), limit(count)));
            return reverse(snapshot.docs.map(toSourceDoc));
        },

        async get(id) {
            const snapshot = await getDoc(doc(messagesRef, id));
            if (!snapshot.exists()) return null;
            const found = toSourceDoc(snapshot);
            return clearedAt && found.time <= clearedAt ? null : found;
        },

        page(request: PageRequest<Handle>, listener) {
            const older = request.direction === "older";
            const constraints: QueryConstraint[] = [...bounds, orderBy("time", older ? "desc" : "asc")];
            if (request.from) {
                constraints.push(request.from.inclusive ? startAt(request.from.doc.handle) : startAfter(request.from.doc.handle));
            }
            constraints.push(limit(request.limit));
            // A "desc" query answers newest first; the store always wants oldest first.
            return subscribe(query(messagesRef, ...constraints), listener, older ? reverse : oldestFirst);
        },

        tail(from, listener) {
            const constraints: QueryConstraint[] = [...bounds, orderBy("time", "asc")];
            if (from) constraints.push(startAt(from.handle));
            return subscribe(query(messagesRef, ...constraints), listener, oldestFirst);
        },
    };
}
