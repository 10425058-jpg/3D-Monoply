# V11 game feel and animation

V11 makes three moments easier to read during play. The two dice settle on their committed faces and the result badge shows each die and their total. A token anticipates each hop, turns through the shortest angle at a corner, and marks its arrival with a wider ripple. Purchases, upgrades, and transfers show their effects on the deed or player involved.

## Presentation changes

| Event | Feedback |
|---|---|
| Dice | Staggered bounces, contact shadows, impact sounds, and outlines around the final up-facing pips. Doubles add gold rings and a distinct chime. |
| Turn and movement | Player-colored trails and landing ripples, a smooth identity-ring handoff, and a short turn announcement. Successive AI turns use a shorter, silent announcement. |
| Property purchase | An owner-colored wash and a gold outline mark the deed. The existing ownership marker grows into place as the purchase receipt and debit appear. |
| Construction | Land has a short ground pulse. Houses rise from a foundation with low dust, apartments add a delayed roof rise, and hotels finish with a rising gold ring and a longer chime. |
| Transactions | Existing copper, silver, and gold coins follow the confirmed route. Green and red amounts identify the recipients and payers. Both island balances in a direct transfer start counting at the shared arrival time. |
| Special events | GO gets a salary pulse, Jail gets a lock, and the existing card and auction notices animate their artwork. Bank Heist reveals the vault payout. Shutdown marks the targeted island with stronger feedback for a confirmed downgrade. Eliminated tokens briefly desaturate. The results dialog can celebrate with gold confetti. |

`PresentationProvider` and the Solo and Online adapters use committed activity and ledger identities to coalesce repeated delivery. `Dice3D` and `AnimatedToken` play from scene state. `ArcadePropertyLots` and `BoardTileDetails` update the affected property instances, and the Classic construction animation requires a matching construction receipt. `PlayerIslandMoney` and `useIslandTreasuryMotion` reuse the existing coin and balance system. `GameplayFeedback`, `ActivityLog`, and `BalanceText` bring the same cues into the existing HUD and V9 notices.

The burst pool holds at most 40 board particles, the treasury holds at most 10 flights with seven coins each, and the audio engine holds at most 12 oscillator voices. The sounds are original Web Audio synthesis. Lower graphics settings use fewer particles. Reduced motion keeps results and balance changes readable with stationary cues. Restart, reconnect, tab hiding, and the end of a match clear pending presentation work.

## Gameplay evidence

The captures use the actual Solo controls in Chrome with seeded test rolls and close camera angles. The clips record the game canvas and briefly hold key poses for the screenshots. The screenshots also show the HUD and notices.

- [Doubles screenshot](evidence/01-doubles.jpg) and [dice and token clip](evidence/dice-and-token.webm)
- [Purchase screenshot](evidence/02-property-purchase.jpg), [house construction screenshot](evidence/03-house-construction.jpg), and [purchase and build clip](evidence/purchase-and-build.webm)
- [Apartment](evidence/apartment.jpg) and [Hotel](evidence/hotel.jpg)
- [Community Chest screenshot](evidence/04-community-chest.jpg) and [Jail screenshot](evidence/06-jail.jpg)
- [Online Community Chest screenshot](evidence/online-community-chest.png)
- [Rent screenshot](evidence/05-rent-transfer.jpg) and [rent transfer clip](evidence/rent-transfer.webm)
- [Bank Heist](evidence/heist-reward.jpg), [Shutdown](evidence/shutdown-result.jpg), [bankruptcy](evidence/bankruptcy.jpg), and [victory](evidence/victory.jpg)

## Verification

| Check | Result |
|---|---|
| TypeScript and Vite production build | Passed. |
| Frontend unit suite | 224 of 225 passed in V11. The ownership-rail test expects two rails and finds four. V10 has the same failure and passed 223 of 224. |
| Backend build, migrations, and unit suite | Passed. All 59 backend tests passed. |
| Existing Chrome dice suite | Passed all six face values, rapid clicks, consecutive doubles, and resets during and after a roll in normal and reduced motion. |
| V11 Chrome suite | Passed face and doubles-badge checks, instrumented collision and doubles sounds, four distinct shared GO positions, tile steps through GO, purchase and construction, Community Chest, Jail, and a single direct rent route. The two balances settled at $1,496 and $1,504. |
| V9 popup regression suite | Passed 37 dialog checks at six viewport sizes, including auction, cards, Bank Heist, Shutdown, bankruptcy, and victory. [Popup results](evidence/v9-popups.json) |
| Arcade Solo Chrome suite | Passed land purchase and all three upgrades, including duplicate-click protection, AI turns, card notices, and mobile layout. [Arcade results](evidence/arcade-results.json) |
| Online Chrome with NestJS, Socket.IO, and PostgreSQL | Passed two-client Chance and rent, quiet restore after refresh, four-client Community Chest and payments, mobile layout, and three renderer remounts. [Online results](evidence/online-results.json) |

The V11 restart probe cancelled a live rent flight five times. At the same idle fixture after collection, Chrome reported 272 geometries and 38 textures before and after. Used heap increased by 196 KiB across the probe. [Chrome test receipt](evidence/browser.json)

The Online remounts each reported 250 geometries and 36 textures with identical buffer and texture allocation estimates. Post-GC JavaScript heap rose by 1.94 MiB across the three samples. The archived V10 run of the same test rose by 2.00 MiB. The source of the recurring Online heap growth remains unresolved. [V10 remount investigation](../v10-performance/README.md)

## Performance

The benchmark compares V10 at `a5971de` with the V11 production build in headless Chrome on an AMD Radeon 610M using ANGLE D3D11. Both builds use Balanced graphics at 1440 × 900 and DPR 1. Two pairs use fresh browser contexts and the same scenes, camera, seed, and inputs. The script alternates which build runs first. Each pass warms the dice and token path, then measures six rolls and three property upgrades.

Each p50 and p95 below is the median of the two per-pass results. Frame intervals are in milliseconds. Sample counts give totals across both passes.

| Scene | V10 p50 | V11 p50 | V10 p95 | V11 p95 | V10 / V11 samples |
|---|---:|---:|---:|---:|---:|
| Idle | 120.2 | 130.1 | 168.3 | 272.2 | 40 / 34 |
| Orbit and zoom | 134.7 | 163.0 | 267.7 | 281.5 | 84 / 81 |
| Dice | 183.1 | 107.2 | 271.3 | 238.0 | 29 / 39 |
| Token movement | 150.2 | 118.2 | 328.5 | 261.7 | 72 / 94 |
| Construction | 25.5 | 158.3 | 1,340.0 | 909.7 | 21 / 21 |
| Settings dialog | 212.2 | 175.4 | 313.7 | 360.0 | 23 / 24 |
| Developed Arcade board | 142.3 | 139.6 | 259.0 | 261.6 | 34 / 34 |
| Classic stress board | 125.8 | 172.3 | 201.5 | 370.4 | 38 / 21 |

Dice and token movement had lower median and p95 intervals. Idle and Classic stress tails rose in this run, so the full benchmark leaves frame-time parity unverified. The idle and Classic stress scenes submitted the same median draw calls and triangle counts in both builds. Median CPU time in `WebGLRenderer.render` went from 3.8 to 3.4 ms at idle and from 5.6 to 5.3 ms on the Classic stress board. V11 submitted three additional draws during the roll and two during token movement.

Run `node scripts/v10-performance.mjs --warm-dice` with the two production builds served locally. `V10_BASELINE_URL`, `V10_CANDIDATE_URL`, and `V10_OUTPUT` select the two builds and the receipt destination. [Raw frame samples](evidence/benchmark-balanced.json)

A separate check kept both builds warm in one Chrome process and alternated the foreground canvas four times per scene. Each build supplied 32 frame intervals per scene at the same camera pose. The idle p50 moved from 189.5 to 185.0 ms and its p95 moved from 207.6 to 227.7 ms. The Classic stress p50 moved from 192.5 to 208.9 ms and its p95 moved from 241.0 to 257.9 ms. The p95 gaps narrowed in this shorter check. Run `node scripts/v11-settled-performance.mjs` against the same two servers. [Interleaved frame samples](evidence/settled-frame-times.json)
