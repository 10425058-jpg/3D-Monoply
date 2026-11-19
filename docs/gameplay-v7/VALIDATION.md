# V7 validation

## Browser evidence

| Moment | Baseline | V7 |
| --- | --- | --- |
| Full gameplay | [Opening](evidence/before/active-game.jpg) | [Opening](evidence/after/active-game.jpg) |
| Dice windup through token landing | [Baseline sequence](evidence/README.md#dice-and-motion) | [V7 sequence](evidence/README.md#dice-and-motion) |
| Purchase and ownership | [Purchase](evidence/before/purchase.jpg), [deed and mortgage markers](evidence/before/ownership.jpg) | [Committed $60 purchase](evidence/after/purchase.jpg), [deed and mortgage markers](evidence/after/ownership.jpg) |
| Rent and GO | [Rent](evidence/before/rent.jpg), [GO](evidence/before/go-salary.jpg) | [$4 rent](evidence/after/rent.jpg), [$200 salary](evidence/after/go-salary.jpg) |
| Card reveal | [Chance](evidence/before/chance.jpg), [Community Chest](evidence/before/community-chest.jpg) | [Chance](evidence/after/chance.jpg), [Community Chest](evidence/after/community-chest.jpg) |
| Auctions | [Live bid](evidence/before/auction.jpg) | [Live bid](evidence/after/auction.jpg), [$11 winner](evidence/after/auction-won.jpg) |
| Trade | [Trade form](evidence/before/trade.jpg) | [Both offers and resulting balances](evidence/after/trade.jpg) |
| Construction | [House](evidence/before/construction.jpg), [hotel](evidence/before/hotel.jpg) | [House and committed cost](evidence/after/construction.jpg), [hotel](evidence/after/hotel.jpg) |
| Landmark | [Level one](evidence/before/landmark.jpg) | [Level one and payment](evidence/after/landmark.jpg) |
| Jail | [Sent to Jail](evidence/before/jail.jpg), [choices](evidence/before/jail-options.jpg) | [Sent to Jail](evidence/after/jail.jpg), [choices](evidence/after/jail-options.jpg) |
| Elimination and victory | [Bankruptcy](evidence/before/bankruptcy.jpg), [victory](evidence/before/victory.jpg) | [Bankruptcy](evidence/after/bankruptcy.jpg), [final portfolios](evidence/after/victory.jpg) |
| Mobile HUD | [Rent at 390 × 844](evidence/before/mobile-rent.jpg) | [Rent at 390 × 844](evidence/after/mobile-rent.jpg) |

The motion trace captured the rendered faces `3 + 5` and tile IDs 1 through 8 in both builds. V7 recorded 142 browser screencast frames, including 50 post-render roll samples and 75 airborne hop samples. Positions, balances, ownership and construction were checked against the live game. Headless Web Audio instrumentation observed 391 scheduled oscillators in a running context during the V7 evidence run. The audio regression also checked gesture gating, volume, mute, voice limits and cleanup.

Online browser captures show the live $60 purchase receipt, the active match at desktop and mobile sizes, the server pause after a socket loss, and final standings. The purchase profile captured 30 frames with a peak of 177 draw calls while committing and rendering the transaction. [Live purchase](evidence/online/purchase.jpg) · [Desktop match](evidence/online/match.jpg) · [Mobile match](evidence/online/mobile.jpg) · [Paused match](evidence/online/paused.jpg) · [Final standings](evidence/online/results.jpg) · [Purchase profile](evidence/online/purchase-results.json)

## Performance

Both builds ran sequentially in Headless Chrome 157 on the same Windows host, using ANGLE/D3D11 on AMD Radeon 610M. Desktop capture used 1440 × 900 at DPR 1 with Balanced graphics. Frame times include the browser frame interval. Draw calls and geometry counts come from the Three.js renderer.

| Interaction | Frames before / after | Median frame ms before / after | P95 frame ms before / after | Median draw calls before / after |
| --- | --- | --- | --- | --- |
| Idle | 221 / 220 | 9.9 / 9.9 | 12.1 / 12.7 | 189 / 189 |
| Repeated roll and walk | 584 / 604 | 9.8 / 9.6 | 13.0 / 12.0 | 202 / 200 |
| Purchase | 23 / 25 | 10.4 / 10.8 | 19.0 / 12.1 | 206 / 206 |
| Rent | 105 / 107 | 10.9 / 10.5 | 13.1 / 12.9 | 208 / 204 |
| Card reveal | 141 / 148 | 10.3 / 9.8 | 15.7 / 13.0 | 203 / 199 |
| Construction | 22 / 19 | 15.1 / 15.0 | 18.5 / 22.9 | 191 / 193 |
| Sustained Solo, nine handoffs | 2240 / 1924 | 10.5 / 10.1 | 13.6 / 13.4 | 206 / 206 |

The construction sample had a higher P95 with similar median. Its short window and the single desktop GPU limit the conclusions for low-end hardware. The mobile run verifies layout and interaction at a mobile viewport. Sustained Solo played one match through three complete rounds of human and AI turns at 2×. Four equal-workload mounts passed the existing allocation checks. [Baseline measurements](evidence/before/results.json) · [V7 measurements](evidence/after/results.json)

## Tests

| Command | Local result |
| --- | --- |
| `npm run build` and `npm run lint` | Passed |
| `npm run test:solo` | 52 passed |
| `npm run test:online` | 21 passed |
| `npm run test:animations` | 21 passed |
| `npm run test:graphics` | 14 passed |
| `npm run test:graphics-v6` | 8 graphics and 21 animation checks passed |
| `npm run test:menu` | 4 passed |
| `npm run test:menu-browser` | Four viewport sizes passed the navigation and lazy-loading checks |
| `npm run test:board-browser` | Solo scenarios, replay, four equal-workload mounts, all three graphics tiers, optional font failure and eight decision checks passed |
| `node scripts/final-graphics-v6-dice.mjs --matrix` | All 36 pairs in each motion mode, consecutive doubles, Jail rolls, rapid clicks and reset passed |
| `npm run test:online-browser` | Ten real two-player scenarios passed, including action replay, synchronized boards, reload, disconnect, resume and final rankings |
| `npm run test:rules-online-browser` | Authenticated Nearest Utility instructions, live purchase receipt and quiet reload passed |
| Backend build and `npm test` | Build and 59 engine/session checks passed |
| Backend `npm run test:integration` | 14 REST, Socket.IO, PostgreSQL and lifecycle checks passed |

Run the Solo evidence collection with `node scripts/gameplay-v7-evidence.mjs` and set `V7_TEST_URL` to the local candidate or baseline preview. The browser tests use the repository's loopback-only test hook. Backend and Online integration used PostgreSQL 16 and a disposable local copy of the unchanged NestJS build with a loopback bind.

## Failure classification

| Observation | Classification and resolution |
| --- | --- |
| Windows sandbox startup failures in `tsx` and esbuild | Infrastructure. The unchanged baseline and candidate ran with the parent-directory and user lookup access required by those tools. |
| Historical reported dice orientation and timing failures | Unverified on remote `main`. The original baseline browser suite passed locally. The expanded test captures the rendered quaternion during the roll and at rest, so the result stays available to assertions after the fade. |
| Baseline evidence click missed after closing the Chance reveal | Test synchronization. Paired recording waits for the outgoing card and uses the same enabled Build control in both builds, then verifies the actual house count and debit. |
| Dice readout overlapped the new turn cue | Application defect found in the first V7 capture. The layout was adjusted and the mobile and desktop checks verified separate readouts. |
| Initial AI test placed a heist in `PRE_ROLL` | Test fixture defect. The production action correctly rejected the phase. The corrected test uses the established `END_TURN` raid phase and verifies the selected non-maximal payout. |
| The first V7 waiting room fetched a shared gameplay chunk | Application defect caught by the real browser navigation assertion. Match presentation now loads after the authorized snapshot. |
| The first focused Online purchase harness closed with a pending response wait | Test synchronization. The repaired fixture joins its guest through Socket.IO, observes the response and input together, and records diagnostics before cleanup. |
