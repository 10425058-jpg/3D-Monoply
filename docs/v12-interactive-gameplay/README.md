# V12 interactive gameplay and water

Solo Classic and Arcade players draw Chance and Community Chest cards from a face-down deck, then confirm the revealed instructions. AI seats use the same draw and resolve actions on their turn. A second card landing opens a fresh decision. Restarting clears the pending decision and its animation.

Solo rent records the debtor, creditor, property, development tier, and amount at landing. A human confirms with **Pay** before the transfer is committed. The rent dialog offers the existing liquidation and trade actions if cash is short. The completed payment produces one receipt and starts the V11 coin and balance effects. Online’s `mini-v1` ruleset resolves rent and cards in the authoritative server action. It has no payment confirmation or manual draw phase.

The floating-island water shader uses deeper turquoise shadows, brighter cyan lanes, and a denser water body. The authored waterways and the existing crest, mist, and edge fades use the same meshes and render passes.

## Browser captures

- [Face-down Chance card](evidence/01-chance-draw.jpg)
- [Revealed Chance card](evidence/02-chance-revealed.jpg)
- [Rent Payment with a developed Arcade property](evidence/03-rent-payment.jpg)
- Water comparison from the same camera. [V11 waterfall](evidence/water-before.jpg) · [V12 waterfall](evidence/water-after.jpg)

## Frame times

The benchmark compared the production builds at V11 commit `5ddcca6` and V12 in one active Chrome tab on an AMD Radeon 610M using ANGLE D3D11. Both builds used Balanced graphics at 1440 × 900 and DPR 1. The animation clock was held for the screenshots. Four alternating pairs sampled 120 animated frames per build and view.

| View | V11 p50 | V12 p50 | V11 p95 | V12 p95 | Draw calls per frame |
| --- | ---: | ---: | ---: | ---: | ---: |
| Waterfall close-up | 40.5 ms | 24.8 ms | 144.9 ms | 140.1 ms | 92 |
| Board overview | 63.5 ms | 61.0 ms | 165.5 ms | 128.7 ms | 257 |

Both builds submitted one render pass and the same triangle count in each view. The waterfall shader skips crest noise after the foam fades and limits surface lighting to the water body. [Raw frames and GPU timings](evidence/water-performance.json)

## Verification

- `npm run lint` and `npm run build`
- `npm run test:solo` and `npm run test:online`
- `node --test tests/background-waterfall.test.mjs tests/animations.test.mjs`
- `node --import tsx --test test/engine.test.ts` from `backend`
- `node scripts/v12-browser.mjs` against the loopback production preview on port 4271. [Gameplay browser results](evidence/browser.json)
- `node scripts/rules-audit-browser.mjs` against the V12 preview via `V5_TEST_URL`
- `node scripts/v12-water-browser.mjs` against the V11 and V12 loopback production previews on ports 4270 and 4271

Local checks used Node 24.21.0 and Chrome 158.
