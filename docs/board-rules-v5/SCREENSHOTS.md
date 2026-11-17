# V5 visual and gameplay evidence

Seven matched pairs use saved main **0ba0a2f** and the final V5 build. The script
asserts matching camera, viewport, DPR, drawing buffer and quality. Final north
and east labels retain the correct word order when read at their board rotation.
Overview, top and phone also verify all 40 tile rays, with no city/environment
occlusion. The four close label views intentionally crop the board; they are
diagnostic poses, not new user camera presets. The existing overview composition
and full-name property card remain useful on a small screen, where tiny on-board
text cannot be expected to read at desktop size.

| View / quality | Baseline | V5 |
| --- | --- | --- |
| overview / balanced | [Before](evidence/before/overview.png) | [After](evidence/after/overview.png) |
| top / high | [Before](evidence/before/top.png) | [After](evidence/after/top.png) |
| south-labels / high | [Before](evidence/before/south-labels.png) | [After](evidence/after/south-labels.png) |
| west-labels / high | [Before](evidence/before/west-labels.png) | [After](evidence/after/west-labels.png) |
| north-labels / high | [Before](evidence/before/north-labels.png) | [After](evidence/after/north-labels.png) |
| east-labels / high | [Before](evidence/before/east-labels.png) | [After](evidence/after/east-labels.png) |
| phone / low | [Before](evidence/before/phone.png) | [After](evidence/after/phone.png) |

## Confirmed live actions

Deterministic fixtures establish the scenario, then real buttons/rolls execute
the store actions. Diagnostics observe the rendered world quaternion of each
die, actual token positions, buildings and instanced state markers. All six
faces were checked on both dice. Fixture APIs require a loopback hostname and
explicit `?soloTest`; ordinary gameplay exposes neither audit global.

- [opening](evidence/regression/opening.png)
- [dice-landing](evidence/regression/dice-landing.png)
- [purchase](evidence/regression/purchase.png)
- [rent-payment](evidence/regression/rent-payment.png)
- [house-construction](evidence/regression/house-construction.png)
- [hotel-upgrade](evidence/regression/hotel-upgrade.png)
- [ownership-mortgage](evidence/regression/ownership-mortgage.png)
- [jail-entry](evidence/regression/jail-entry.png)
- [jail-options](evidence/regression/jail-options.png)
- [chance-reveal](evidence/regression/chance-reveal.png)
- [chest-reveal](evidence/regression/chest-reveal.png)
- [card-chain-reveal](evidence/regression/card-chain-reveal.png)
- [debt-resolution](evidence/regression/debt-resolution.png)
- [auction-won](evidence/regression/auction-won.png)
- [bankruptcy](evidence/regression/bankruptcy.png)
- [victory](evidence/regression/victory.png)
- [six-player-start](evidence/regression/six-player-start.png)
- [ai-full-round](evidence/regression/ai-full-round.png)
- [Normal token hop and dice motion](evidence/regression/normal-motion-dice.png)
- [Blocked optional font, live HUD receipt](evidence/regression/optional-font-fallback.png)

Receipts: [18 scenarios, restart and four scene mounts](evidence/regression/results.json),
[normal motion/context restoration/font fault](evidence/regression/resilience.json),
[all 40 mouse/touch spaces and camera interactions](evidence/interaction/results.json).
Run `npm run test:board-browser` against a production preview; use
`V5_TEST_URL` and `V5_EVIDENCE_OUT` to select its origin/output.
The paired script is `node scripts/board-v5-review.mjs before|after` with
baseline preview at 4192 and candidate at 4193. Never capture candidate output
as `before`.
