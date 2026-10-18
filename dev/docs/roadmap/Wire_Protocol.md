# Anima Wire Protocol v0 (draft)

> The host↔microcontroller contract — Anima's equivalent of the Bottango
> firmware protocol, but open and ours. Implemented by the Python
> reference host (`aether_animation/wire.py`), Studio's serial
> `AnimationOutput`, and the Arduino/ESP32 firmware. Change this doc
> first, implementations second (see `dev/briefings/` protocol).

## Transport

UTF-8 lines (`\n`-terminated) over USB serial, 115200 8N1. Also runs
unchanged over TCP for simulators. Fields are comma-separated; no
spaces. Commands are uppercase. v0 has no checksum — a known gap;
v1 adds one if line noise shows up in practice.

Host reply handling: every command expects one reply line; hosts set a
read timeout per reply (the Python reference uses 0.5 s, and 2 s for
`HELLO` because many boards reset when the port opens) and surface a
missing/garbled reply as an error to the operator — no silent retry.
That host error is the operator signal only; the device-side failsafe
below is the safety net that actually disarms hardware on a dead link.

## Values

Channel values are normalized floats `0.0..1.0` — the same range as rig
blend shapes and joint parameters. Physical meaning (pulse width range,
angle range, inversion) is configured per channel with `CFG`, never
baked into animation data.

## Host → device

| Command | Meaning |
|---|---|
| `HELLO,0` | Handshake; `0` is the protocol version. Device replies `ANIMA,...`. |
| `CFG,<ch>,<type>,<k=v>,...` | Configure channel. v0 type: `servo`. Keys: `pin`, `min_us`, `max_us`, `invert=0/1`, `neutral` (0..1). Ex: `CFG,0,servo,pin=9,min_us=600,max_us=2400,neutral=0.5` |
| `FRM,<ms>,<ch>:<val>,...` | Move listed channels to targets over `<ms>` milliseconds, device-side linear interpolation. `FRM,0,...` = jump now. Ex: `FRM,33,0:0.500,1:0.250` |
| `EN,<ch>,<0/1>` | Enable/disable a channel (detach servo signal when 0). |
| `STOP` | E-stop: immediately disable every output. Always honored, never queued. |
| `PING` | Heartbeat probe; device replies `PONG`. |

## Device → host

| Reply | Meaning |
|---|---|
| `ANIMA,0,<name>,<n_channels>` | Handshake reply. |
| `OK` | Command accepted. |
| `ERR,<code>,<msg>` | Rejected: `1` parse, `2` bad channel, `3` bad value, `4` not configured. |
| `PONG` | Heartbeat reply. |

## Failsafe

If a device handles no **successfully parsed command** for
`failsafe_ms` (default 2000, set per channel via the `CFG`
`failsafe_ms` key), it disables that channel's output — same behavior
as `STOP`. Malformed or rejected lines (anything answered with `ERR`)
do **not** refresh the heartbeat: line noise from a dying connection
must never keep a servo armed. A disconnected cable must never leave a
servo straining.

## Strictness

Ambiguous input is rejected, never resolved silently: a duplicate key
within one `CFG`, or the same channel listed twice within one `FRM`,
is `ERR,1` — no last-write-wins.

## Streaming rates

Live puppeteering streams `FRM` at 30–60 Hz with `<ms>` ≈ the frame
interval, so device-side interpolation smooths between frames. Offline
playback may use sparse `FRM`s with long durations for linear segments;
curved segments are sampled by the host — the device stays dumb.
