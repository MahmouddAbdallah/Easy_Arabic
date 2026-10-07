/**
 * The browser's whole call lifecycle, as a plain class with a subscribable state (React reads it with
 * useSyncExternalStore, see ../CallProvider.tsx). One controller, at most one call at a time.
 *
 *   caller   startCall ──▶ outgoing (calling → ringing) ──▶ connecting ──▶ active ──▶ ended
 *   callee   doorbell ──▶ incoming ──▶ acceptCall ──▶ answering ──▶ connecting ──▶ active ──▶ ended
 *
 * The server owns the truth about a call (./callMachine.ts); this class mirrors it. Two things tell it
 * that something changed: the Firestore "doorbell" (instant) and the API itself (heartbeats, a slow
 * poll while ringing, and a faster one if the doorbell is unreachable), so a missed doorbell only ever
 * costs a few seconds. The WebRTC details live in ./callEngine.ts, how good the connection is and what video it
 * can carry in ./callQuality.ts.
 *
 * A dropped connection is not the end of a call: the media is brought back by restarting ICE, retried with growing
 * pauses, for CALL_RECONNECT_TIMEOUT_MS (longer once this browser is back online, or the other side is seen
 * negotiating). Nothing is restarted while the browser is offline.
 */
import axios from "axios";
import { collection, doc, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import toast from "react-hot-toast";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import {
    CALL_CONNECT_TIMEOUT_MS,
    CALL_HEARTBEAT_MS,
    CALL_RECONNECT_GRACE_MS,
    CALL_RECONNECT_TIMEOUT_MS,
    isRingingStatus,
    parseCallDoorbell,
    type CallDoorbell,
    type CallIceServer,
    type CallMode,
    type CallOffer,
    type CallPeer,
    type CallRole,
    type CallSignal,
    type CallStatus,
    type CallView,
    type ClientEndReason,
} from "./call";
import { callApi, endCallOnExit, type CallReply } from "./callApi";
import {
    CallEngine,
    CallMediaError,
    getCallMediaErrorMessage,
    getCallSupportProblem,
    getCameraErrorMessage,
    openLocalMedia,
    type EngineConnectionState,
    type LocalMedia,
} from "./callEngine";
import type { ConnectionQuality, QualityLevel } from "./callQuality";
import { callSounds, unlockCallSounds } from "./callSounds";
import { getErrorMessage } from "./getErrorMessage";

/* -------------------------------------------------------------------------------------------------
 * The state the UI renders
 * ---------------------------------------------------------------------------------------------- */

export type CallPhase =
    | "idle"
    /** Caller: opening the microphone/camera and placing the call. */
    | "starting"
    /** Caller: placed. The server says "calling" until the other browser confirms, then "ringing". */
    | "outgoing"
    /** Callee: ringing. */
    | "incoming"
    /** Callee: accepted; opening the microphone/camera and answering. */
    | "answering"
    /** Answered; the media connection is being set up. */
    | "connecting"
    /** Media is flowing. */
    | "active"
    /** Media dropped (network change); trying to get it back. */
    | "reconnecting"
    /** The final screen, shown for a moment. */
    | "ended";

export type CallEndedKind = "ended" | "declined" | "missed" | "cancelled" | "busy" | "failed";

export interface CallSessionState {
    phase: CallPhase;
    callId: string | null;
    role: CallRole | null;
    mode: CallMode;
    peer: CallPeer | null;
    /** What the server last said, e.g. "calling" or "ringing" while the caller waits. */
    serverStatus: CallStatus | null;
    endedKind: CallEndedKind | null;
    /** Local time at which media first flowed: the base of the timer. */
    connectedAt: number | null;
    /** Talk time in seconds, for the final screen. */
    duration: number;
    muted: boolean;
    cameraOff: boolean;
    remoteMuted: boolean;
    remoteCameraOff: boolean;
    /** The other side stopped sending video because its connection is too weak (the voice carries on). */
    remoteVideoPaused: boolean;
    /** This browser stopped sending video for the same reason. */
    videoPaused: boolean;
    canSwitchCamera: boolean;
    mirrorLocal: boolean;
    /** A video call without a working camera: the person is heard but not seen. */
    videoUnavailable: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    /** Offline right now: the screen says so instead of looking frozen. */
    offline: boolean;
    /** How good the connection is, or null before the first measurement. The details are in `getQuality()`. */
    quality: QualityLevel | null;
    /** A message the screen shows inline (e.g. "microphone blocked" while the call is still ringing). */
    notice: string | null;
}

export const IDLE_CALL_STATE: CallSessionState = {
    phase: "idle",
    callId: null,
    role: null,
    mode: "audio",
    peer: null,
    serverStatus: null,
    endedKind: null,
    connectedAt: null,
    duration: 0,
    muted: false,
    cameraOff: false,
    remoteMuted: false,
    remoteCameraOff: false,
    remoteVideoPaused: false,
    videoPaused: false,
    canSwitchCamera: false,
    mirrorLocal: true,
    videoUnavailable: false,
    localStream: null,
    remoteStream: null,
    offline: false,
    quality: null,
    notice: null,
};

/** Phases in which a call screen is on display. */
const SCREEN_PHASES: ReadonlySet<CallPhase> = new Set(["starting", "outgoing", "answering", "connecting", "active", "reconnecting"]);
/** Phases in which the server is waiting on someone to answer or connect. */
const WAITING_PHASES: ReadonlySet<CallPhase> = new Set(["outgoing", "incoming", "answering", "connecting"]);

/** How long the final screen stays, by how the call ended. */
const ENDED_SCREEN_MS: Record<CallEndedKind, number> = {
    ended: 2000,
    failed: 2800,
    declined: 2800,
    missed: 2800,
    cancelled: 0,
    busy: 2800,
};

/** Slow safety-net poll while the call is being set up (the doorbell is the fast path). */
const SAFETY_POLL_MS = 6000;
/** Poll used when the doorbell can't be reached at all. */
const FALLBACK_POLL_MS = 1500;
const FALLBACK_IDLE_POLL_MS = 4000;
/** Extra wait after the ring should have expired, so the server's clock has certainly passed it. */
const RING_END_GRACE_MS = 1000;
/** A dropped connection often heals itself; ICE is only restarted after this. */
const ICE_RESTART_DELAY_MS = 2000;
/** A connection that is still down is retried, a little later each time: after 3 s, 6 s, 9 s, then every 10 s. */
const RESTART_RETRY_STEP_MS = 3000;
const RESTART_RETRY_MAX_MS = 10_000;
/** "Reconnecting…" only shows once the connection has stayed down this long: a blip that heals itself isn't worth a flash. */
const RECONNECTING_SHOWN_AFTER_MS = 1500;
/** Seconds without a single packet, on a connection that still says "connected", before it counts as dropped. */
const STALL_SECONDS = 8;
/** TURN passwords last about an hour: a call older than this gets fresh servers before an ICE restart. */
const ICE_SERVERS_MAX_AGE_MS = 30 * 60_000;

const kindOf = (mode: CallMode) => (mode === "video" ? "video" : "voice");

function endedKindOf(view: CallView): CallEndedKind {
    switch (view.status) {
        case "declined":
            return "declined";
        case "missed":
            return "missed";
        case "cancelled":
            return "cancelled";
        case "busy":
            return "busy";
        default:
            return view.connectedAt !== null ? "ended" : "failed";
    }
}

/** The call is over (or never existed) as far as the server is concerned. */
function isCallGone(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 404;
}

/* -------------------------------------------------------------------------------------------------
 * The controller
 * ---------------------------------------------------------------------------------------------- */

export class CallController {
    private state: CallSessionState = IDLE_CALL_STATE;
    private readonly listeners = new Set<() => void>();

    private userId: string | null = null;
    private incomingUnsubscribe: Unsubscribe | null = null;
    private callUnsubscribe: Unsubscribe | null = null;
    private doorbellOk = true;
    private removeListeners: (() => void) | null = null;

    // The current call. Reset by `teardown()`.
    private engine: CallEngine | null = null;
    private callId: string | null = null;
    private role: CallRole | null = null;
    /** Highest signal number already applied. */
    private cursor = 0;
    /** The doorbell counter this browser has already synced to. */
    private lastRev = -1;
    /** Server time minus local time: a wrong local clock must not shorten or lengthen the ring. */
    private clockOffset = 0;
    /** Signals that arrived while ringing (the offer and early candidates), applied on accept. */
    private held: CallSignal[] = [];
    private iceServers: Promise<CallIceServer[]> | null = null;
    /** When the servers the engine uses were fetched. */
    private iceServersAt = 0;
    private syncing = false;
    private syncAgain = false;
    private outbound: Promise<void> = Promise.resolve();
    private cameraBusy = false;
    /** Bumped whenever a session starts or ends: an async step that finds it changed stops quietly. */
    private attempt = 0;
    /** Calls this browser has already shown, so a repeated doorbell never rings twice. */
    private readonly handled = new Set<string>();

    private ringTimer: ReturnType<typeof setTimeout> | null = null;
    private connectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;
    private blipTimer: ReturnType<typeof setTimeout> | null = null;
    private dismissTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private pollEvery = 0;
    private titleTimer: ReturnType<typeof setInterval> | null = null;
    private originalTitle = "";

    // Getting a dropped connection back.
    private engineState: EngineConnectionState = "connecting";
    /** The media is down right now (ICE says so, or nothing has arrived for a while). */
    private linkDown = false;
    private restartAttempt = 0;
    private reconnectDeadline = 0;
    private silentSeconds = 0;

    // The connection reading changes every second, so it has its own subscription: the call screen isn't redrawn for it.
    private quality: ConnectionQuality | null = null;
    private readonly qualityListeners = new Set<() => void>();

    /* ---- store ---- */

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): CallSessionState => this.state;

    subscribeQuality = (listener: () => void): (() => void) => {
        this.qualityListeners.add(listener);
        return () => this.qualityListeners.delete(listener);
    };

    getQuality = (): ConnectionQuality | null => this.quality;

    private setQuality(quality: ConnectionQuality | null) {
        this.quality = quality;
        this.qualityListeners.forEach((listener) => listener());
    }

    private setState(patch: Partial<CallSessionState>) {
        this.state = { ...this.state, ...patch };
        this.applyEffects();
        this.listeners.forEach((listener) => listener());
    }

    /* ---- lifecycle of the controller ---- */

    /** Starts listening for calls to `userId`. */
    attach(userId: string) {
        if (this.userId === userId) return;
        this.detach();
        this.userId = userId;
        this.doorbellOk = true;
        unlockCallSounds();

        // Calls addressed to this user, in any of their chats. The doorbell holds no secrets, only "something changed".
        this.incomingUnsubscribe = onSnapshot(
            query(collection(firebaseClientDB, "chats"), where("call.calleeId", "==", userId)),
            (snapshot) => {
                for (const change of snapshot.docChanges()) {
                    if (change.type !== "removed") this.onDoorbell(parseCallDoorbell(change.doc.get("call")));
                }
            },
            (error) => this.doorbellFailed(error)
        );

        const onPageHide = () => {
            // A reload or a closed tab can't hang up with a normal request. A ringing incoming call is left
            // alone: the person may well answer it after the reload.
            if (this.callId && this.state.phase !== "incoming") endCallOnExit(this.callId);
        };
        const setOnline = () => {
            this.setState({ offline: false });
            if (!this.callId) return;
            this.requestSync();
            this.beat(); // tell the server this browser is alive again before its clock runs out
            if (this.linkDown) {
                // Back online while the media is down: try right now instead of waiting for the next attempt.
                this.extendReconnectDeadline();
                this.scheduleRestart(0);
            } else {
                void this.engine?.restartIce(); // the route may have changed even though nothing has noticed yet
            }
        };
        const setOffline = () => this.setState({ offline: true });
        const onVisibilityChange = () => {
            // Coming back to a call (a phone unlocked, a tab revisited): report in, and don't wait out a retry delay.
            if (document.visibilityState !== "visible" || !this.callId) return;
            this.beat();
            if (this.linkDown && !this.state.offline) this.scheduleRestart(0);
        };
        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("online", setOnline);
        window.addEventListener("offline", setOffline);
        document.addEventListener("visibilitychange", onVisibilityChange);
        this.removeListeners = () => {
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("online", setOnline);
            window.removeEventListener("offline", setOffline);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
        if (typeof navigator !== "undefined" && navigator.onLine === false) this.setState({ offline: true });
        this.updatePolling();
    }

    /** Stops listening. A call in progress is hung up: this browser can no longer carry it. */
    detach() {
        if (this.callId && this.state.phase !== "incoming") void callApi.end(this.callId).catch(() => undefined);
        this.teardown();
        this.clearDismissTimer();
        this.incomingUnsubscribe?.();
        this.incomingUnsubscribe = null;
        this.removeListeners?.();
        this.removeListeners = null;
        this.userId = null;
        this.handled.clear();
        this.setState({ ...IDLE_CALL_STATE });
    }

    /* ---- what the person can do ---- */

    async startCall(peer: CallPeer, mode: CallMode): Promise<void> {
        if (!this.userId) return;
        if (this.state.phase === "ended") this.dismissEnded();
        if (this.state.phase !== "idle") {
            toast.error("You're already in a call.", { id: "call-busy" });
            return;
        }
        const problem = getCallSupportProblem();
        if (problem) {
            toast.error(problem, { id: "call-unsupported" });
            return;
        }

        const attempt = ++this.attempt;
        this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline, phase: "starting", role: "caller", mode, peer });

        let engine: CallEngine | null = null;
        try {
            // The permission prompt and the ICE servers are independent: do both at once.
            const [media, iceServers] = await Promise.all([openLocalMedia(mode), callApi.iceServers()]);
            if (attempt !== this.attempt) {
                // Hung up while the permission prompt was open.
                media.stream.getTracks().forEach((track) => track.stop());
                return;
            }

            engine = this.createEngine("caller", mode, iceServers, media);
            this.engine = engine;
            this.showLocalMedia(engine, media);

            const offer = await engine.createOffer();
            if (attempt !== this.attempt) {
                engine.close();
                return;
            }

            const reply = await callApi.start(peer.id, mode, offer);
            const view = reply.call;
            if (attempt !== this.attempt) {
                // Hung up while the request was on its way: the call exists now, so it must be ended.
                engine.close();
                if (view) void callApi.end(view.id).catch(() => undefined);
                return;
            }
            if (!view) throw new Error("The server didn't return the call.");

            this.callId = view.id;
            this.role = "caller";
            this.cursor = 0;
            this.lastRev = view.rev;
            this.clockOffset = reply.serverNow - Date.now();
            this.handled.add(view.id);
            this.setState({ callId: view.id, peer: view.peer, serverStatus: view.status, phase: "outgoing" });

            if (view.status === "busy") {
                this.conclude("busy", { local: false });
                return;
            }

            engine.setSignalingReady(true);
            this.watchCall(view.chatId);
            this.armRingTimer(view.ringExpiresAt);
            this.startHeartbeat();
        } catch (error) {
            engine?.close();
            if (attempt !== this.attempt) return;
            this.teardown();
            this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
            toast.error(error instanceof CallMediaError ? getCallMediaErrorMessage(error) : getErrorMessage(error), {
                id: "call-start-error",
            });
        }
    }

    async acceptCall(): Promise<void> {
        const { phase, mode } = this.state;
        const callId = this.callId;
        if (phase !== "incoming" || !callId) return;

        const attempt = this.attempt;
        this.setState({ phase: "answering", notice: null });

        let engine: CallEngine | null = null;
        try {
            const [media, iceServers] = await Promise.all([openLocalMedia(mode), this.iceServers ?? callApi.iceServers()]);
            if (attempt !== this.attempt) {
                media.stream.getTracks().forEach((track) => track.stop());
                return;
            }

            // Normally the offer arrived while ringing. After a failed attempt it must be asked for again.
            const offer = this.heldOffer() ?? (await this.refetchOffer(callId));
            if (attempt !== this.attempt) {
                media.stream.getTracks().forEach((track) => track.stop());
                return;
            }
            if (!offer) throw new Error("The call has no offer.");

            engine = this.createEngine("callee", mode, iceServers, media);
            this.engine = engine;
            this.showLocalMedia(engine, media);

            const answer = await engine.acceptOffer(offer);
            // Everything else the caller already sent (its ICE candidates) can be applied right away.
            for (const signal of this.held.splice(0)) {
                if (signal.type !== "offer") void engine.handleSignal(signal);
            }

            const reply = await callApi.accept(callId, answer, this.cursor);
            if (attempt !== this.attempt) {
                engine.close();
                return;
            }
            this.applyReply(reply);
            if (attempt !== this.attempt || this.callId !== callId) return; // the reply said the call is over

            engine.setSignalingReady(true);
            this.startHeartbeat();
            this.armConnectTimer();
        } catch (error) {
            engine?.close();
            if (attempt !== this.attempt) return;
            this.engine = null;
            if (isCallGone(error)) {
                this.conclude("failed", { local: false });
                return;
            }
            // Couldn't answer (microphone blocked, no network, ...). The call is still ringing: stay on it so it
            // can be retried. Whatever the failed attempt used up is asked for again from the server, which keeps
            // every signal of the call: a cursor of 0 means "send me everything".
            this.held = [];
            this.cursor = 0;
            this.setState({
                phase: "incoming",
                localStream: null,
                notice: error instanceof CallMediaError ? getCallMediaErrorMessage(error) : getErrorMessage(error),
            });
        }
    }

    declineCall(): void {
        const callId = this.callId;
        if (this.state.phase !== "incoming" || !callId) return;
        this.conclude("declined", { local: true });
        void callApi.decline(callId).catch((error) => console.warn("[call] Couldn't decline the call:", error));
    }

    /** Hangs up: cancels a ringing call, ends a connected one, or abandons one that is still starting. */
    endCall(reason: ClientEndReason = "hangup"): void {
        const { phase, connectedAt } = this.state;
        if (phase === "incoming") return this.declineCall();
        if (phase === "starting") {
            // Nothing to tell the server yet: whatever the async steps of startCall create is cleaned up when they notice.
            this.attempt++;
            this.engine?.close();
            this.teardown();
            this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
            return;
        }

        const callId = this.callId;
        if (!callId) return;
        const connected = connectedAt !== null;
        this.conclude(connected ? "ended" : this.role === "caller" ? "cancelled" : "ended", { local: true });
        void callApi.end(callId, reason).catch((error) => console.warn("[call] Couldn't hang up:", error));
    }

    toggleMute(): void {
        const engine = this.engine;
        if (!engine) return;
        engine.setMuted(!engine.isMuted);
        this.setState({ muted: engine.isMuted });
    }

    async toggleCamera(): Promise<void> {
        const engine = this.engine;
        if (!engine || this.cameraBusy) return;
        this.cameraBusy = true;
        try {
            await engine.setCameraOff(!engine.isCameraOff);
            this.setState({ cameraOff: engine.isCameraOff, localStream: engine.localStream, mirrorLocal: engine.mirrorLocal });
        } catch (error) {
            toast.error(getCameraErrorMessage(error), { id: "call-camera-error" });
        } finally {
            this.cameraBusy = false;
        }
    }

    async switchCamera(): Promise<void> {
        const engine = this.engine;
        if (!engine || this.cameraBusy) return;
        this.cameraBusy = true;
        try {
            await engine.switchCamera();
            this.setState({ localStream: engine.localStream, mirrorLocal: engine.mirrorLocal });
        } catch (error) {
            toast.error(getCameraErrorMessage(error), { id: "call-camera-error" });
        } finally {
            this.cameraBusy = false;
        }
    }

    /** Closes the final screen. */
    dismissEnded(): void {
        this.clearDismissTimer();
        if (this.state.phase === "ended") this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
    }

    /* ---- the engine ---- */

    private createEngine(role: CallRole, mode: CallMode, iceServers: CallIceServer[], media: LocalMedia): CallEngine {
        this.iceServersAt = Date.now();
        return new CallEngine({
            role,
            mode,
            iceServers,
            media,
            events: {
                onSignals: (signals) => this.sendSignals(signals),
                onConnectionState: (state) => this.onConnectionState(state),
                onLocalStream: (stream) =>
                    this.setState({ localStream: stream, mirrorLocal: this.engine?.mirrorLocal ?? true }),
                onRemoteStream: (stream) => this.setState({ remoteStream: stream }),
                onRemoteMedia: ({ muted, cameraOff, videoPaused }) =>
                    this.setState({ remoteMuted: muted, remoteCameraOff: cameraOff, remoteVideoPaused: videoPaused }),
                onQuality: (quality) => this.onQuality(quality),
                onDeviceLost: (kind) => {
                    toast.error(kind === "audio" ? "Your microphone was disconnected." : "Your camera was disconnected.", {
                        id: `call-device-${kind}`,
                    });
                    if (kind === "video") this.setState({ cameraOff: true, localStream: this.engine?.localStream ?? null });
                },
            },
        });
    }

    private showLocalMedia(engine: CallEngine, media: LocalMedia) {
        this.setState({
            localStream: engine.localStream,
            mirrorLocal: engine.mirrorLocal,
            cameraOff: engine.isCameraOff,
            videoUnavailable: media.videoUnavailable,
        });
        if (media.videoUnavailable) {
            toast("Your camera isn't available. You'll be heard, but not seen.", { icon: "📷", id: "call-no-camera" });
        }
        void engine.canSwitchCamera().then((canSwitch) => {
            if (this.engine === engine) this.setState({ canSwitchCamera: canSwitch });
        });
    }

    private onConnectionState(state: EngineConnectionState) {
        const callId = this.callId;
        if (!callId) return;
        this.engineState = state;

        if (state === "connected") {
            this.linkRestored();
            this.clearTimer("connectTimer");

            const first = this.state.connectedAt === null;
            const { phase } = this.state;
            if (WAITING_PHASES.has(phase) || phase === "reconnecting") {
                this.setState({ phase: "active", connectedAt: first ? Date.now() : this.state.connectedAt, notice: null });
            }
            if (first) {
                void callApi
                    .connected(callId, this.cursor)
                    .then((reply) => this.applyReply(reply))
                    .catch((error) => this.onSyncError(error));
            }
            return;
        }

        // `disconnected` is often a blip that heals by itself; `failed` is not.
        if (state === "disconnected" || state === "failed") this.linkLost(state === "failed" ? 0 : ICE_RESTART_DELAY_MS);
    }

    /* ---- getting a dropped connection back ---- */

    /** The media stopped (ICE says so, or nothing has arrived for a while): show it, and keep trying to get it back. */
    private linkLost(restartAfter: number) {
        this.linkDown = true;

        // Only a call that has been connected can be "reconnecting"; one that never was is bounded by its connect timeout.
        if (this.state.connectedAt !== null) {
            if (this.state.phase === "active") {
                if (restartAfter === 0 || this.state.offline) {
                    this.setState({ phase: "reconnecting" });
                } else if (this.blipTimer === null) {
                    this.blipTimer = setTimeout(() => {
                        this.blipTimer = null;
                        if (this.linkDown && this.state.phase === "active") this.setState({ phase: "reconnecting" });
                    }, RECONNECTING_SHOWN_AFTER_MS);
                }
            }
            if (this.reconnectTimer === null) this.armReconnectTimer(CALL_RECONNECT_TIMEOUT_MS);
        }
        if (this.restartTimer === null || restartAfter === 0) this.scheduleRestart(restartAfter);
    }

    /** The media is flowing again (or never stopped): every recovery attempt ends. */
    private linkRestored() {
        this.linkDown = false;
        this.restartAttempt = 0;
        this.silentSeconds = 0;
        this.reconnectDeadline = 0;
        (["reconnectTimer", "restartTimer", "blipTimer"] as const).forEach((timer) => this.clearTimer(timer));
    }

    private armReconnectTimer(ms: number) {
        this.clearTimer("reconnectTimer");
        this.reconnectDeadline = Date.now() + ms;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.failCall("connection_lost");
        }, ms);
    }

    /** Somebody is clearly still there (this browser is back online, the other one is negotiating): a little longer. */
    private extendReconnectDeadline() {
        if (this.reconnectTimer === null) return;
        if (this.reconnectDeadline - Date.now() < CALL_RECONNECT_GRACE_MS) this.armReconnectTimer(CALL_RECONNECT_GRACE_MS);
    }

    private scheduleRestart(delay: number) {
        this.clearTimer("restartTimer");
        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            void this.attemptRecovery();
        }, delay);
    }

    /** One try at finding a new route. If the media is still down afterwards, another follows a little later. */
    private async attemptRecovery() {
        const engine = this.engine;
        const callId = this.callId;
        if (!engine || !callId) return;

        // With the browser offline there is nothing to restart over: the `online` event brings the next attempt.
        if (!this.state.offline) {
            this.restartAttempt++;
            await this.refreshIceServers(engine);
            if (this.engine !== engine || this.callId !== callId) return;
            await engine.restartIce();
            if (this.engine !== engine || this.callId !== callId) return;
        }
        if (!this.linkDown) return;
        this.scheduleRestart(Math.min(RESTART_RETRY_STEP_MS * Math.max(1, this.restartAttempt), RESTART_RETRY_MAX_MS));
    }

    /** A call can outlive its TURN passwords; an ICE restart with expired ones couldn't reach a relay. */
    private async refreshIceServers(engine: CallEngine) {
        if (this.iceServersAt === 0 || Date.now() - this.iceServersAt < ICE_SERVERS_MAX_AGE_MS) return;
        const fresh = await callApi.refreshIceServers();
        if (fresh && this.engine === engine) {
            engine.updateIceServers(fresh);
            this.iceServersAt = Date.now();
        }
    }

    private onQuality(quality: ConnectionQuality) {
        this.setQuality(quality);

        const paused = quality.sending?.paused ?? false;
        if (quality.level !== this.state.quality || paused !== this.state.videoPaused) {
            this.setState({ quality: quality.level, videoPaused: paused });
        }

        // ICE can go on saying "connected" for a while after the media stopped (a phone that fell asleep, a route
        // that died quietly). Seconds without a single packet are treated as a dropped connection.
        if (quality.sample.silent) {
            this.silentSeconds++;
            if (this.silentSeconds >= STALL_SECONDS && !this.linkDown && this.state.phase === "active" && !this.state.offline) {
                this.linkLost(0);
            }
        } else {
            this.silentSeconds = 0;
            if (this.linkDown && this.engineState === "connected") this.onConnectionState("connected");
        }
    }

    /** The call can't go on (no connection, no media): the other side is told, this one shows why. */
    private failCall(reason: ClientEndReason) {
        const callId = this.callId;
        if (!callId) return;
        // Not `local`: nobody pressed End, so the person must be told why the screen is going away.
        this.conclude("failed", { local: false });
        void callApi.end(callId, reason).catch(() => undefined);
    }

    /* ---- the doorbell and the API ---- */

    private onDoorbell(bell: CallDoorbell | null) {
        const userId = this.userId;
        if (!bell || !userId) return;

        if (bell.id === this.callId) {
            const rev = bell.revs[userId] ?? 0;
            if (rev === this.lastRev) return; // nothing new for this user
            this.lastRev = rev;
            this.requestSync();
            return;
        }

        if (bell.calleeId === userId && isRingingStatus(bell.status) && !this.handled.has(bell.id)) {
            this.handled.add(bell.id);
            // Already in a call: the server told the caller "busy" and never rang, so this is only a late echo.
            if (this.state.phase === "idle" || this.state.phase === "ended") void this.receive(bell.id);
        }
    }

    private doorbellFailed(error: unknown) {
        console.warn("[call] Live call updates are unavailable, falling back to polling:", error);
        this.doorbellOk = false;
        this.updatePolling();
    }

    private watchCall(chatId: string) {
        // The callee hears about its call through the incoming-calls listener; the caller needs its own.
        if (this.role !== "caller") return;
        this.callUnsubscribe?.();
        this.callUnsubscribe = onSnapshot(
            doc(firebaseClientDB, "chats", chatId),
            (snapshot) => this.onDoorbell(parseCallDoorbell(snapshot.get("call"))),
            (error) => this.doorbellFailed(error)
        );
    }

    /** A call for this user: show it and ring. */
    private async receive(callId: string): Promise<void> {
        if (this.state.phase === "ended") this.dismissEnded();
        const attempt = ++this.attempt;
        try {
            this.iceServers = callApi.iceServers(); // warm: Accept should be instant
            const reply = await callApi.get(callId, 0);
            const view = reply.call;
            if (attempt !== this.attempt) return;
            // Too late (answered elsewhere, expired, cancelled): nothing to show. The chat has the missed call.
            if (!view || view.role !== "callee" || !isRingingStatus(view.status)) return;

            this.callId = view.id;
            this.role = "callee";
            this.cursor = 0;
            this.held = [];
            this.lastRev = view.rev;
            this.clockOffset = reply.serverNow - Date.now();
            this.setState({
                ...IDLE_CALL_STATE,
                offline: this.state.offline,
                phase: "incoming",
                callId: view.id,
                role: "callee",
                mode: view.mode,
                peer: view.peer,
                serverStatus: view.status,
            });
            this.ingest(view.signals);
            this.armRingTimer(view.ringExpiresAt);

            // "Ringing…" on the caller's screen.
            void callApi
                .ringing(view.id, this.cursor)
                .then((next) => this.applyReply(next))
                .catch((error) => this.onSyncError(error));
        } catch (error) {
            console.warn("[call] Couldn't open the incoming call:", error);
            if (attempt === this.attempt) this.handled.delete(callId); // a later doorbell may try again
        }
    }

    /** Asks the server what changed. Requests never overlap: one that arrives meanwhile runs right after. */
    private requestSync() {
        if (!this.callId) return;
        if (this.syncing) {
            this.syncAgain = true;
            return;
        }
        this.syncing = true;
        void (async () => {
            try {
                do {
                    this.syncAgain = false;
                    const { callId } = this;
                    const attempt = this.attempt;
                    if (!callId) break;
                    const reply = await callApi.get(callId, this.cursor);
                    if (attempt !== this.attempt) break;
                    this.applyReply(reply);
                } while (this.syncAgain && this.callId);
            } catch (error) {
                this.onSyncError(error);
            } finally {
                this.syncing = false;
            }
        })();
    }

    private onSyncError(error: unknown) {
        // A network blip is not worth reacting to: the next heartbeat or doorbell catches up. A call the
        // server no longer knows is over.
        if (isCallGone(error) && this.callId) this.conclude("failed", { local: false });
    }

    private sendSignals(signals: Parameters<typeof callApi.signal>[1]) {
        const callId = this.callId;
        if (!callId) return;
        const attempt = this.attempt;
        // One request at a time keeps the offer, the answer and the candidates in the order they were made.
        this.outbound = this.outbound.then(async () => {
            if (attempt !== this.attempt) return;
            try {
                const reply = await callApi.signal(callId, signals, this.cursor);
                if (attempt === this.attempt) this.applyReply(reply);
            } catch (error) {
                if (attempt === this.attempt) this.onSyncError(error);
            }
        });
    }

    /** Everything the server says about the call goes through here. */
    private applyReply(reply: CallReply) {
        const view = reply.call;
        if (!view || view.id !== this.callId) return;

        this.clockOffset = reply.serverNow - Date.now();
        this.lastRev = Math.max(this.lastRev, view.rev);
        this.ingest(view.signals);
        this.applyStatus(view);
    }

    /** New signaling messages, each applied once and in order (the cursor makes a repeat harmless). */
    private ingest(signals: CallSignal[]) {
        const fresh = signals.filter((signal) => signal.seq > this.cursor).sort((a, b) => a.seq - b.seq);
        if (fresh.length === 0) return;
        this.cursor = fresh[fresh.length - 1].seq;
        // The other side is renegotiating: it is there, and the recovery deserves the time to finish.
        if (this.linkDown && fresh.some((signal) => signal.type !== "candidate")) this.extendReconnectDeadline();

        for (const signal of fresh) {
            // A callee that hasn't answered has no connection yet: the messages wait for it.
            if (this.engine) void this.engine.handleSignal(signal);
            else this.held.push(signal);
        }
    }

    /** The offer the caller made, if it is among what arrived while ringing. */
    private heldOffer(): CallOffer | null {
        const signal = this.held.find((candidate) => candidate.type === "offer");
        return signal?.type === "offer" ? signal.data : null;
    }

    /** Everything the server has for this call, from the start: the offer and the caller's candidates. */
    private async refetchOffer(callId: string): Promise<CallOffer | null> {
        this.cursor = 0;
        this.held = [];
        this.applyReply(await callApi.get(callId, 0));
        return this.heldOffer();
    }

    private applyStatus(view: CallView) {
        const { phase } = this.state;
        this.setState({ peer: view.peer, serverStatus: view.status });

        switch (view.status) {
            case "calling":
            case "ringing":
                this.armRingTimer(view.ringExpiresAt);
                return;

            case "connecting":
            case "active":
                this.clearTimer("ringTimer");
                if (phase === "incoming") {
                    // Answered on another tab or device of this user: stop ringing here, quietly.
                    this.dismissSilently();
                } else if (phase === "outgoing") {
                    this.setState({ phase: "connecting" });
                    this.armConnectTimer();
                }
                return;

            default:
                this.conclude(endedKindOf(view), { local: view.endedBy === "me" });
        }
    }

    /* ---- the end of a call ---- */

    private dismissSilently() {
        this.handled.add(this.callId ?? "");
        this.teardown();
        this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
    }

    /** The call is over: stop everything and tell the person, as much as they need to be told. */
    private conclude(kind: CallEndedKind, { local }: { local: boolean }) {
        const { phase, mode, peer, connectedAt } = this.state;
        const callId = this.callId;
        this.teardown();

        if (phase === "incoming") {
            // Never answered: a quiet notice, not a screen. (A decline made here needs no notice at all.)
            if (kind === "missed" || kind === "cancelled") {
                toast(`Missed ${kindOf(mode)} call from ${peer?.name ?? "someone"}`, {
                    icon: "📞",
                    id: `call-missed-${callId ?? ""}`,
                    position: "top-center",
                });
            }
            this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
            return;
        }

        const hadScreen = SCREEN_PHASES.has(phase);
        const duration = connectedAt === null ? 0 : Math.max(0, Math.round((Date.now() - connectedAt) / 1000));
        // Hanging up yourself needs no explanation, just a beat to confirm it when there was a conversation.
        const showFor = !hadScreen ? 0 : local ? (connectedAt !== null ? 1200 : 0) : ENDED_SCREEN_MS[kind];

        if (showFor === 0) {
            this.setState({ ...IDLE_CALL_STATE, offline: this.state.offline });
            if (hadScreen && local) callSounds.playEnded();
            return;
        }

        this.setState({
            phase: "ended",
            endedKind: kind,
            duration,
            // The final screen keeps showing the other person, but nothing live.
            localStream: null,
            remoteStream: null,
            notice: null,
        });
        if (kind === "busy") callSounds.playBusy();
        else callSounds.playEnded();
        this.clearDismissTimer();
        this.dismissTimer = setTimeout(() => this.dismissEnded(), showFor);
    }

    /** Stops everything that belongs to the current call. */
    private teardown() {
        this.attempt++;
        this.engine?.close();
        this.engine = null;
        this.callId = null;
        this.role = null;
        this.cursor = 0;
        this.lastRev = -1;
        this.held = [];
        this.iceServers = null;
        this.iceServersAt = 0;
        this.engineState = "connecting";
        this.linkDown = false;
        this.restartAttempt = 0;
        this.reconnectDeadline = 0;
        this.silentSeconds = 0;
        if (this.quality !== null) this.setQuality(null);
        this.syncing = false;
        this.syncAgain = false;
        this.outbound = Promise.resolve();
        this.cameraBusy = false;

        (["ringTimer", "connectTimer", "reconnectTimer", "restartTimer", "blipTimer"] as const).forEach((timer) => this.clearTimer(timer));
        if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.callUnsubscribe?.();
        this.callUnsubscribe = null;
        callSounds.stopAll();
    }

    private clearTimer(name: "ringTimer" | "connectTimer" | "reconnectTimer" | "restartTimer" | "blipTimer") {
        const timer = this[name];
        if (timer !== null) clearTimeout(timer);
        this[name] = null;
    }

    private clearDismissTimer() {
        if (this.dismissTimer !== null) clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
    }

    /* ---- timers ---- */

    /** When the ring should be over (by the server's clock), look again: the server settles it as missed. */
    private armRingTimer(ringExpiresAt: number) {
        this.clearTimer("ringTimer");
        const remaining = ringExpiresAt - (Date.now() + this.clockOffset);
        this.ringTimer = setTimeout(() => {
            this.ringTimer = null;
            this.requestSync();
        }, Math.max(remaining + RING_END_GRACE_MS, 1500));
    }

    /** Answered but never connected: give up instead of waiting for ever. */
    private armConnectTimer() {
        if (this.connectTimer !== null) return;
        this.connectTimer = setTimeout(() => {
            this.connectTimer = null;
            if (this.state.connectedAt === null) this.failCall("connection_failed");
        }, CALL_CONNECT_TIMEOUT_MS);
    }

    private startHeartbeat() {
        if (this.heartbeatTimer !== null) return;
        this.heartbeatTimer = setInterval(() => this.beat(), CALL_HEARTBEAT_MS);
    }

    /** "I'm still here" to the server (its reply carries anything new too). Only once the call is answered. */
    private beat() {
        const callId = this.callId;
        if (!callId || this.heartbeatTimer === null) return;
        const attempt = this.attempt;
        callApi
            .heartbeat(callId, this.cursor)
            .then((reply) => attempt === this.attempt && this.applyReply(reply))
            .catch((error) => attempt === this.attempt && this.onSyncError(error));
    }

    /** The safety net under the doorbell: a slow poll while a call is being set up, a fast one without a doorbell. */
    private updatePolling() {
        let every = 0;
        if (this.callId) {
            every = !this.doorbellOk ? FALLBACK_POLL_MS : WAITING_PHASES.has(this.state.phase) ? SAFETY_POLL_MS : 0;
        } else if (this.userId && !this.doorbellOk) {
            every = FALLBACK_IDLE_POLL_MS;
        }
        if (every === this.pollEvery) return;

        if (this.pollTimer !== null) clearInterval(this.pollTimer);
        this.pollTimer = null;
        this.pollEvery = every;
        if (every > 0) this.pollTimer = setInterval(() => this.poll(), every);
    }

    private poll() {
        if (this.callId) return this.requestSync();
        // No doorbell and no call: ask whether somebody is calling.
        void callApi
            .current()
            .then(({ call }) => {
                if (!call || call.role !== "callee" || !isRingingStatus(call.status) || this.handled.has(call.id)) return;
                this.handled.add(call.id);
                if (this.state.phase === "idle" || this.state.phase === "ended") void this.receive(call.id);
            })
            .catch(() => undefined);
    }

    /* ---- sound and the tab title ---- */

    private applyEffects() {
        const { phase } = this.state;

        if (phase === "incoming") callSounds.startRingtone();
        else callSounds.stopRingtone();

        if (phase === "outgoing") callSounds.startRingback();
        else callSounds.stopRingback();

        this.flashTitle(phase === "incoming");
        this.updatePolling();
    }

    private flashTitle(on: boolean) {
        if (typeof document === "undefined") return;

        if (on && this.titleTimer === null) {
            this.originalTitle = document.title;
            let flip = false;
            const tick = () => {
                document.title = flip ? this.originalTitle : `📞 Incoming ${kindOf(this.state.mode)} call`;
                flip = !flip;
            };
            tick();
            this.titleTimer = setInterval(tick, 1000);
        } else if (!on && this.titleTimer !== null) {
            clearInterval(this.titleTimer);
            this.titleTimer = null;
            document.title = this.originalTitle;
        }
    }
}
