"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import { readGroup, type GroupInfo } from "../lib/groups";

export type GroupChatState =
    /** No group is open. */
    | { status: "idle"; group: null }
    /** The group's document hasn't answered yet. */
    | { status: "loading"; group: null }
    | { status: "ready"; group: GroupInfo }
    /** There is no such group, or the signed-in user isn't in it. The two look the same on purpose. */
    | { status: "unavailable"; group: null };

const IDLE: GroupChatState = { status: "idle", group: null };
const LOADING: GroupChatState = { status: "loading", group: null };
const UNAVAILABLE: GroupChatState = { status: "unavailable", group: null };

interface Snapshot {
    groupId: string;
    /** What on the screen depends on: while it doesn't change, neither does the state's identity. */
    key: string;
    state: GroupChatState;
}

const keyOf = (group: GroupInfo) =>
    JSON.stringify([group.name, group.description, group.imageUrl, group.createdBy, group.createdAt?.getTime() ?? null, group.admins, group.members]);

/**
 * Follows the open group, chats/{groupId}, live. The document changes with every message (its preview, its
 * time, the unread counters), but none of that is what the conversation screen shows of the group, so the state
 * only changes when its name, picture, description or members do.
 *
 * It is "unavailable" when the document doesn't exist, isn't a group, doesn't list the signed-in user, or can't be
 * read (the Firestore rules say no): in every case the person just isn't in that group.
 */
export function useGroupChat(groupId: string | null, userId: string | undefined): GroupChatState {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

    useEffect(() => {
        if (!groupId || !userId) return;

        const publish = (key: string, state: GroupChatState) =>
            setSnapshot((previous) => (previous && previous.groupId === groupId && previous.key === key ? previous : { groupId, key, state }));

        return onSnapshot(
            doc(firebaseClientDB, "chats", groupId),
            (snap) => {
                const group = snap.exists() ? readGroup(snap.id, snap.data()) : null;
                if (group && group.members.some((member) => member.id === userId)) publish(keyOf(group), { status: "ready", group });
                else publish("unavailable", UNAVAILABLE);
            },
            (error) => {
                console.error("Couldn't open the group:", error);
                publish("unavailable", UNAVAILABLE);
            }
        );
    }, [groupId, userId]);

    if (!groupId) return IDLE;
    return snapshot && snapshot.groupId === groupId ? snapshot.state : LOADING;
}
