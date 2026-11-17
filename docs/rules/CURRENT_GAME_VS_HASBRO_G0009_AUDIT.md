# V5 rules and interaction audit

Baseline: main `0ba0a2f`, including merged central-city PR #56. The user-supplied
`MONOPOLY_CLASSIC_2025_RULES.md` is comparison data, not an instruction to change
the selected mode. Its G0009 column is an edition-specific reference. The
[Hasbro listing](https://instructions.hasbro.com/en-us/instruction/monopoly-board-game-classic-game-with-storage-tray-and-larger-tokens-family-games-8)
identifies that edition; no claim of official Classic compliance is made.
Solo remains the existing custom game; Online stays `mini-v1`, content
`central-castle@1`, governed by [its own specification](../ONLINE-MVP-RULES.md).

The live Solo route imports `App.tsx`, not the old standalone TradeModal,
PropertyModal or RulebookModal components. Those older components use a
different UI data model and are not evidence that their controls are reachable.
The live deed is PropertyCard and the live rules panel is in App.

The matrix records the pre-fix behavior. Verification and final results are tracked
in [the V5 report](../board-rules-v5/README.md). Severity: P0 economy/state,
P1 legal action/turn blocker, P2 misleading feedback, P3 cosmetic.

| System | G0009 comparison | Solo at baseline | Online mini-v1 | Classification / reproduction / required change |
| --- | --- | --- | --- | --- |
| Catalog / coordinates | 40 clockwise US spaces, 28 deeds | Same catalog; established transforms | Versioned server catalog | Catalog/transform fixtures and visual picking tests; preserve values and dimensions |
| Setup | 1500, GO; 2–6 players | 1500, GO; configured local seats | 1500, GO; 2–4 server seats | Intentional setup differences; validate local setup and resets |
| Dice / doubles | Two d6; third double goes directly to Jail | Stored pair drives movement; generation guards exist | Atomic server roll; supported | Existing behavior largely working; deterministic roll/doubles tests |
| Dice / token visuals | Faces and destination match result | Quaternion face mapping and queued hops already tested | Confirmed snapshot adapter | Preserve; test real rendered faces and final token positions |
| GO | 200, qualifying forward crossing | 200 + 50 per landmark level | Fixed 200 | Intentional custom Solo feature, preserve; test forward/backward/Jail moves |
| Purchase | Printed price once; decline auctions | Buy guarded; optional explicit auction; decline skips | Buy/decline; no auctions | Intentional mode differences, preserve optional local auction |
| Rent | Streets, railroad and utility rules; card overrides | Deed rents; only unmortgaged companion railroads/utilities counted; movement dice for utility; nearest RR double | Versioned ordinary RR rent, nearest utility 10× existing dice | Preserve documented companion-count/utility variations. **V5-17 P0:** nearest-RR card says ordinary rental due, but engine charged 2×; remove the undocumented multiplier and test the printed local card |
| Buildings | Even construction/sale; finite 32/12 stock | Even rules, levels 0–5; no finite supply | Unsupported | Unlimited local supply is a mode limitation, not authorization for a new Classic mode |
| Building action phases | No actions during unresolved movement or after finish | build/sell/mortgage can mutate during ROLLING/GAME_OVER | Unsupported | **V5-01 P0:** invoke management action in GAME_OVER; add guards and tests |
| Mortgage rounding | Printed cost; define digital rounding | `ceil(principal * 1.1)` can overcharge e.g. 100 → 111 | Unsupported | **V5-02 P0:** exact integer principal + rounded 10% interest, use same helper in live UI |
| Human debt | Liquidate then settle/bankrupt | Engine supports debt; live App has no settle/bankruptcy panel | Immediate insolvency, no manual resolution | **V5-03 P1:** land on tax/rent without cash; unreachable continuation; add live debt controls |
| AI debt | Same legal liquidity rules | Selects unimproved deeds even when group buildings prevent mortgage; never sells buildings | No AI | **V5-04 P1:** AI owns houses during debt; repeatedly tries illegal mortgage or bankrupts early; use legal liquidation |
| Auction entry | Required after declined purchase | Explicit optional auction rejects AI, while App tells AI to call it | Unsupported | **V5-05 P1:** AI declines affordable deed and remains LANDED_ACTION; allow same auction logic |
| Human auction | Eligible bidders can bid/pass | Engine exists; live App has no bid/pass controls | Unsupported | **V5-06 P1:** click Auction; stuck AUCTION; add bidder controls |
| Auction bids | Opening 10; later >=1 | Log says opening 10, action accepts 1; no bidder identity guard | Unsupported | **V5-07 P0/P1:** opening 1 or stale previous bidder click; validate bid and captured actor |
| Railroad after auction | Not a Classic event | Buy/decline start the custom railroad bonus; both auction terminal paths omit it | Unsupported | **V5-18 P1:** auction an unowned railroad, win or all-pass; resume the same lander's event exactly once |
| Jail options | Pay 50 / held card / try doubles | Engine supports all; live App exposes only roll | Server allowedActions exposes legal exits | **V5-08 P1:** jailed human cannot choose bail/card; add live controls |
| Jail attempts | Three failures; final dice move after bail | Existing forced-bail debt continuation | Atomic server behavior | Preserve/test all attempts, no bonus roll for Jail doubles |
| Held Jail cards | Remove while held; return to source deck | Draw immediately rotates card back; count only, source identity lost | Correct held IDs/source deck | **V5-09 P0:** draw ch_7 then inspect available deck; track held IDs and return correctly |
| Cards / ordinary payments | Printed action once | All 11 action kinds; phase guards | All 11 covered by server tests | Verify every local card, chaining, duplicate resolve |
| Pay each / collect each | Each obligation resolved legitimately | Birthday silently forgives short payment; aggregate pay-each debt loses creditor identity at bankruptcy | Ordered payments and bankruptcy tested | **V5-10 P0:** payer with insufficient cash gets partial free pass; preserve local liquidity options and resolve each debtor/creditor |
| Bankruptcy | Only applicable debt; cash/deeds/cards follow creditor | Unguarded; can eliminate without debt or after finish; buildings/cards discarded | Atomic, guarded | **V5-11 P0:** call outside debt / with developed holdings; guard, account for liquidation and held cards once |
| Victory | Last solvent player | Confetti is called inside engine state updater | Server terminal result | **V5-12 P1/P2:** graphics failure can prevent committed win; move celebration to presentation |
| Trading | Mutual agreement, valid assets, atomic | Live modal can resubmit accepted cash-only deal; human rival assumed to agree | Unsupported | **V5-13 P0/P1:** double-click accepted cash trade; add proposal identity/consent and coherent locks |
| Railroad bonus | Not Classic | Heist/shutdown intentional; pending raid does not block End Turn | Unsupported | **V5-14 P1:** end turn before finishing event; guard; reject fractional/NaN vault index |
| Meta rewards | Not Classic | Daily/wheel/missions/stickers intentional | Unsupported | Preserve; prevent awards mutating finished game or corrupting balances, verify idempotency |
| AI / reset / leave | Digital lifecycle | Effect timers cleaned on unmount; dice/move generation guard; AI callbacks use captured snapshots | Server authority/idempotency/reconnect tests | Add stale-AI identity guard; preserve existing match/scene lifecycle |
| Board labels / interaction | Clear catalog information | Abbreviated SDF labels; filled selection obscures text; no non-color owner identity | Shared presentation | **V5-15 P2/P3:** improve label layout, fine outlines, owner/mortgage markers; preserve physical coordinates |
| Effects / audio | Confirmed results only | Existing event diff, bounded audio, motion guards work; money notices lack rent context | Confirmed adapter; reconnect dedupe | **V5-16 P2:** improve source/recipient context and landing feedback; preserve existing working effects |
| Online authority | Separate digital contract | No client access to online commands | Existing engine + REST idempotency + event version guards | Baseline **59 backend tests pass**, including 500 seeded full games; do not expand mini-v1 |

## Final disposition

All V5-01 through V5-18 repairs are implemented. The actual Solo store is exercised
by 34 tests, with two additional frozen-catalog/transform tests. The existing
online adapter has 17 tests; the independent backend retains all 59 passing tests,
including its 500 seeded full mini-v1 games. A bounded 1,600-action Solo simulation
also checks money, ownership, turn order and deck conservation; it is not a claim
of a full Classic game.

The [live browser receipts](../board-rules-v5/evidence/regression/results.json)
cover purchase, rent, buildings, Jail, both decks, chaining, debt, auctions,
bankruptcy, victory, AI, restart and repeated scene mounts. The
[resilience receipt](../board-rules-v5/evidence/regression/resilience.json) checks
normal motion, all-tier WebGL context restoration and an actual blocked optional
3D-font dependency. The mandatory HUD receipt remains visible during that fault.
The [interaction receipt](../board-rules-v5/evidence/interaction/results.json)
checks all 40 spaces by real mouse/touch and the unchanged camera controls.
Online deed names are bound only by the authorized lazy match screen, keeping
the waiting-room dependency graph free of the gameplay catalog and renderer.
The birthday bankruptcy test also verifies that eliminating another payer
preserves the active drawer's earned doubles turn; its focused pre-fix failure
is retained in [validation](../board-rules-v5/evidence/validation/birthday-turn-before.txt).

Solo's nearest-railroad charge now follows its existing printed card. Auctions
remain optional, but finishing one on a railroad now continues the existing
custom bonus just like buy/decline. Human trade recipients must explicitly agree;
no cash or deeds move while approval is pending. These are intentional behavior
changes. No Classic mode, online command or server rule has been added.

Classic-only differences that remain outside this task include physical building
shortage auctions, compulsory bank auctions on every decline/Bank bankruptcy,
out-of-turn Classic trading/building, G0009 utility rent rolls, exact printed
edition card overrides, mortgage transfer rules and first-player dice selection.
A future strict Classic mode requires an explicit versioned ruleset and API/
content plan; none is silently introduced by V5.
