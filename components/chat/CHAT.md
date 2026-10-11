# Calling upgrade: audit, changes, infrastructure

Scope kept exactly: only `components/chat/**` changed (18 files). Nothing in `app/`, `prisma/`, `package.json`, the lockfile or any config was touched, and no dependency was added.

## 1. Audit

**Already correct (kept, and verified in Chrome 153):** the camera is requested with size and frame rate as hints only (no forced 16:9, `resizeMode: none`), which is what stops a picture being cropped at the source; the other person's picture is shown whole (contain + blurred backdrop) whenever filling the screen would crop more than 12 %; the encoder ceilings match libwebrtc's own defaults (720p about 2.5 Mbps), so raising them would only add CPU load and loss; the governor steps quality down fast and back up slowly, protects audio before video, and recovery uses perfect negotiation and ICE restarts. I did not raise resolution or bitrate.

**Real problems found, each reproduced or unit-tested, and fixed:**

| Finding | Effect | Fix |
|---|---|---|
| Chrome ignores `deviceId: {ideal}` (measured: the default mic and first camera came back even when that was the only constraint) | A "preferred" device is silently replaced by the default | Remembered devices are tried as `exact`, then fall back to the default if gone |
| Relay detection only looked at this side's candidate | A call relayed by the other side showed as "Direct" | Either side relaying counts |
| One malformed URL, or a `turn:` URL without credentials, makes `new RTCPeerConnection` throw | One typo in the ICE env var stops every call from starting | Server and browser both sanitise the list; what was dropped is logged once |
| TURN credentials lived 1 h | A relayed call that outlives them typically loses its relay within about 10 minutes of expiry, because the relay refuses the next allocation refresh. A 60-minute lesson is right at the edge | Default 4 h, clamped to 1-24 h |
| A failed camera switch: a rejection escaped the `.catch`, and when no camera could be recovered the engine still believed the camera was on | Frozen picture, the other side never told | Engine state is put in step and the other side is told |
| Audio problems were invisible: no speech hint, no mic or speaker choice, choppy sound didn't move the quality score | "Good" connection with broken sound | Speech content hint, mono, glitch rate measured and scored, device choice |
| Devices muted by the OS (phone call, another app) were never reopened | Silent mic after an interruption | Reopened after 5 s while the page is visible |
| Wi-Fi to mobile data waited for the old route to die | Seconds of dead call | ICE restart on a network-type change (Chrome on Android), within the signaling budget |

**Deliberately not changed:** codec order (VP9/H.264). The offerer's order decides what the *answerer* sends, so preferring VP9 on a desktop could make a phone encode VP9 in software. It needs real devices to validate; the codec in use is now shown in the diagnostics so it can be judged with real data.

## 2. What was added

* **Audio:** speech-tuned mono microphone with the browser's echo cancellation, noise suppression and level control; sound-glitch rate in the quality score; receive buffer raised 80-300 ms while jitter, loss or glitches last and released after 20 s of calm (`jitterBufferTarget`, where the browser supports it, e.g. Chrome and Edge).
* **Device menu** (sliders icon): microphone with live level meter, camera, speaker (where the browser supports `setSinkId`); lists follow plug/unplug; choices are remembered (`localStorage`, key `chat-call-devices-v1`).
* **Screen sharing** (computers only): replaces the camera on the same video sender, so nothing is renegotiated and nothing can fall out of step. Tuned for text: it keeps its size and gives up frames first (1080p at 15 fps, then 720p, ...). The other side never crops it. The camera is released while sharing and comes back when sharing stops, including via the browser's own "Stop sharing". Trade-off: the camera is not sent at the same time (Meet sends both); that needs a second negotiated stream.
* **Diagnostics** (signal bars): latency, loss, jitter, sound clarity, up/down rate, pictures sent and received, codecs, route (direct or relay, and UDP/TCP/TLS), network type, relay server availability, up to two plain-language tips, and **Copy details** for support.
* Shortcuts **M** mute, **V** camera, **S** share. A banner is always visible while you share.

## 3. STUN/TURN

**Verified:** the short-lived credential scheme is the standard coturn "TURN REST API" one (checked against an independent HMAC-SHA1 computation in the tests); every user gets their own credentials; the endpoint is authenticated, rate limited and `no-store`.

**Infrastructure limits that affect real-world quality, in order of impact:**

1. **No TURN server is configured by default.** Calls then depend on direct paths, and pairs behind symmetric NAT, carrier-grade NAT (common on mobile networks) or UDP-blocking firewalls (offices, schools) fail to connect. Industry figures commonly put this at 10-20 % of call pairs; this is not measured for your users. The server logs a warning once until TURN is set up.
2. With TURN but UDP only, networks that block UDP still fail; without a `turns:` URL, networks that only allow HTTPS (443) fail. Both are logged.
3. Relayed video costs your server about 1-2.5 Mbps per direction per call.
4. The public Google/Cloudflare STUN servers carry no guarantee; they are fine for address discovery only.

**Setup (coturn):**

```
# /etc/turnserver.conf
listening-port=3478
tls-listening-port=443        # own IP if a web server uses 443, otherwise 5349
fingerprint
use-auth-secret
static-auth-secret=<openssl rand -hex 32>
realm=turn.your-domain.com
cert=/etc/letsencrypt/live/turn.your-domain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.your-domain.com/privkey.pem
min-port=49152
max-port=65535
no-multicast-peers
no-cli
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
```

```
# server environment
WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
WEBRTC_TURN_URLS=turn:turn.your-domain.com:3478?transport=udp,turn:turn.your-domain.com:3478?transport=tcp,turns:turn.your-domain.com:443?transport=tcp
WEBRTC_TURN_SECRET=<the same secret>
WEBRTC_TURN_TTL_SECONDS=14400
```

Open UDP and TCP 3478, TCP 443 (or 5349) and UDP 49152-65535. Keep the total of STUN plus TURN URLs under five (browsers slow down from five). A managed relay works too through `WEBRTC_ICE_SERVERS` with the provider's static credentials; short-lived provider credentials would need a small adapter, which is not included.

## 4. Verification

| | Result |
|---|---|
| TypeScript, `components/chat` + `app/api/chat` | 0 errors |
| ESLint, same scope | clean |
| Unit tests (`npx tsx --test "components/chat/lib/*.test.ts"`) | 49 / 49 |
| Real Chrome 153, two real `CallEngine`s over a real `RTCPeerConnection` | 103 / 103 checks, 10 scenarios |
| Real Chrome, the real `CallScreen` with the project's Tailwind (desktop and 390 px phone) | 46 / 46 checks, screenshots in `call-e2e/results/screenshots` |

Reproduced in a real browser: audio and video really flow both ways; echo cancellation, noise suppression and level control are applied; microphone switching keeps a muted person muted; camera select, switch, off and on restore the same camera; screen share replaces and restores the camera, including the browser's own "Stop sharing"; both sides restarting ICE at once (glare) recovers; unplugged and stuck devices are replaced; remembered devices are used, and stale ones fall back without blocking the call.

**Not verifiable in this environment:** behaviour on real cellular and carrier-grade-NAT networks and on iOS Safari; the operating system's screen picker (a canvas stream stands in for `getDisplayMedia`); the real Firestore signaling path through `CallController` (covered by type checking and review; the engine and screen are covered in a browser). Chromium's `fake_device_1` never feeds any `RTCPeerConnection` (verified without project code), so camera frame checks use devices 0 and 2.

## 5. Files

`lib/callEngine.ts` devices, screen share, recovery, receive buffer · `lib/callController.ts` state, actions, network-change restart within the signaling budget · `lib/callQuality.ts` stats, scoring, screen tiers, buffer policy · `lib/callMedia.ts` constraints, devices, preferences, capture · `lib/callIce.ts` (new) + `callIce.server.ts` + `callApi.ts` ICE safety · `Call/DeviceMenu.tsx` (new), `ConnectionIndicator.tsx`, `CallScreen.tsx`, `AdaptiveVideo.tsx`, `ControlButton.tsx` · `hooks/useMediaDevices.ts`, `usePanelDismiss.ts` (new), `useCall.ts` · three `*.test.ts` files.
