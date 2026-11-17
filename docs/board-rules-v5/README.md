# Board, rules and game feel V5

V5 preserves the merged central-city/environment work and repairs the live
custom Solo game on top of main **0ba0a2f**. It improves the 40-space board,
reachable decisions and committed-result feedback. Online remains the separate
server-authoritative **mini-v1 / central-castle@1** contract.

Review: [rules audit and final disposition](../rules/CURRENT_GAME_VS_HASBRO_G0009_AUDIT.md),
[matched screenshots](SCREENSHOTS.md), [measured performance](PERFORMANCE.md).

## Confirmed repairs

- Management, settlement, bankruptcy, rewards and turn actions reject illegal
  phases and terminal games. A pending railroad decision or trade blocks the
  next turn. Invalid vault indexes cannot corrupt balances.
- Unmortgaging uses integer principal plus rounded-up 10% interest; a $100
  principal costs $110, avoiding the floating-point $111 overcharge. Store and
  live UI share the same helper.
- Human debt, auction bids/passes, Jail bail/held-card exits, purchase decline
  and trade consent now have controls in the actual Solo route. The older unused
  standalone modal implementations were not substituted for the live UI.
- AI can enter its requested auction, liquidates only legal deeds/buildings,
  and rejects delayed decisions from another game/actor/phase. Auction bids
  enforce the $10 opening, integer amounts, funds and captured bidder identity.
- Held Jail cards leave their source deck and return there on use or Bank
  bankruptcy; creditor bankruptcy transfers them once. Ordered multi-player
  card payments retain the actual debtor, creditor and remaining obligations.
  Birthday payments no longer silently forgive an unpaid remainder.
  Eliminating another card payer preserves the active drawer's doubles bonus.
- Bankruptcy is allowed only for unresolved debt that legal liquidation cannot
  cover. Cash includes half-price building liquidation; deeds/mortgages/cards
  transfer once; eliminated turns are skipped and the last solvent player wins.
  Victory no longer depends on browser confetti inside a state updater.
- Accepted cash-only trades cannot submit twice. Human recipients explicitly
  accept or reject before any transfer; existing AI valuation is retained.
- The local nearest-railroad card now charges its printed ordinary rent, removing
  an undocumented 2× charge. Both terminal auction paths now resume the existing
  railroad lander bonus consistently with buy/decline.

## Board and feedback

The original catalog, prices, color groups, physical transforms, tile picking
surfaces and board foundation stay intact. An original 1024² canvas atlas gives
all 40 spaces full names, prices and vector medallion icons without an external
board font. Instanced color bands, gold dividers, thin interaction outlines,
owner-color trim, P1–P6 identity badges and M mortgage badges read the real scene
state. Mortgaged surfaces are muted. No independent ownership model is added.

Labels/icons are batched into at most six instanced groups; atlas/materials are
stable during ownership updates, explicitly disposed on unmount and recover
after context loss. The fixed atlas costs 4 MiB RGBA base / about 5.33 MiB with
mipmaps. Detailed live counts, memory estimates and timing limits are in the
performance report.

Tokens now sit above the physical tile surface and have six distinct shared-tile
slots; the existing queued, eased hops remain. House/hotel heights follow the
color bands. Darker dice pips improve contrast, and existing dice trails provide
a short landing burst without a new particle pool. World dice faces continue to
derive from the committed pair; presentation never rolls a separate result.

Transaction notices consume new committed log/event IDs and explain the actual
amount, source, recipient and deed. Existing balance receipts remain. Silent
context notices do not duplicate money audio. Bankruptcy/Jail/victory take sound
priority; building sales use cash feedback. The existing gesture unlock, mute,
volume, bounded voices and audio disposal are preserved. Reduced motion retains
the HUD/card/action feedback while skipping decorative movement.

Optional floating 3D money labels have a local Suspense/error boundary: a slow
or failed default font cannot replace the entire game with its loading screen.
An actual blocked Troika font-resolution dependency was tested; committed rent,
the canvas and HUD receipt remained visible.

## Validation

Executed after resuming on Windows, Node 24.21.0:

| Check | Observed result |
| --- | --- |
| TypeScript (`npm run lint`) | Passed |
| Production (`npm run build`, including TypeScript) | Passed |
| Solo store + frozen board/server catalog | 36 passed |
| Online adapter/security/lifecycle | 17 passed |
| Existing menu/presentation/camera/environment/asset suites | 64 passed |
| Existing backend mini-v1 engine/session cleanup | 59 passed |
| Total automated tests | **176 passed, 0 failed** |
| Live Solo browser | 18 captured scenarios, 12 rendered dice, restart and four equal-workload mounts passed |
| Existing graphics browser | All 40 spaces at four desktop/tablet/phone sizes, mouse/touch, presets/top/reset/orbit/zoom and real purchase/end-turn passed |
| Resilience browser | All-tier context restoration, normal token/dice animation and blocked optional font passed |
| Matched art pairs | Seven final pairs; camera/DPR/viewports match saved main |
| Performance | Nine matched 20-second cases per build; see raw samples/report |

The 34 Solo tests exercise the actual store, including every card action kind,
Jail attempts/forced bail, doubles, legal liquidity, money/deed/card conservation,
stale callbacks and 1,600 seeded legal actions. The backend's unchanged suite
also includes **500 seeded complete mini-v1 games**. These are different modes;
the bounded Solo simulation is not described as a full Classic game.

Raw local test/build receipts are in [evidence/validation](evidence/validation).
Browser data and images are indexed in the screenshot report. CI adds the Solo
suite, backend suite and Solo browser/fault checks alongside the existing real
two-profile Chrome/PostgreSQL online test and menu browser test. The workflow
uses the project's supported Node 22; its result belongs to the PR checks.

The original `solo-before.txt` contains an early sandbox loader failure, not a
valid rules-test result; it is preserved and must not be cited as a rules failure.
The [isolated baseline reproduction](evidence/validation/baseline-first19.txt)
runs the first 19 regression cases against archived main source without modifying
the working tree: **8 pass and 11 fail**, reproducing the repaired defects. These
red cases identify the prior behavior rather than failing V5. Reproduce with
`node scripts/board-v5-baseline-rules.mjs`.

Useful commands:

```text
npm run lint
npm run build
npm run test:solo
npm run test:online
node --test tests/menu-loading.test.mjs tests/animations.test.mjs tests/graphics.test.mjs tests/environment.test.mjs tests/atmosphere.test.mjs tests/archipelago.test.mjs tests/environment-assets.test.mjs tests/central-city.test.mjs
npm --prefix backend test
V5_TEST_URL=<preview> V5_EVIDENCE_OUT=<output> npm run test:board-browser
AUDIT_URL=<preview> GRAPHICS_REGRESSION_OUT=<output> npm run test:graphics-browser
node scripts/board-v5-report.mjs
```

The local Windows build used the pre-existing `.online-test/rollup-wasm.cjs`
loader shim for this installation. It is not a production dependency or source
change; clean Linux CI uses the normal build command.

## Preserved scope and limitations

- No edits to `CenterCity3D`, castle assets/components, outside environment,
  camera implementation, board/card catalog, menu, backend, auth or public assets.
  The player-panel design and global theme remain. Only online event wording
  changes on the client; no commands, authority, sessions or network lifecycle
  changes were made.
- Solo is intentionally custom: landmark GO bonuses, railroad heists/shutdowns,
  daily/wheel/missions/stickers, optional auctions, unlimited local building
  supply, unmortgaged companion counting and movement-dice utility rent remain.
  The live rules panel names these variations. The supplied Classic document is
  comparison material, not authority to silently change the selected mode.
- Online mini-v1 does not gain Solo AI, auctions, trading, manual insolvency,
  buildings or a new Classic ruleset. See its versioned specification.
- Small-screen overview text is physically small; tap/select a deed for the
  existing full-size information card. Labels remain readable in closer views.
- Performance evidence is one GPU/browser with warm assets and frozen world
  motion. CPU/texture estimates are not driver VRAM measurements. Long-running
  human play on every device and subjective speaker/audio quality are not
  established by these automated receipts.
- FPS attribution remains inconclusive because the unchanged baseline slowed
  sharply on this host too. The report retains the complete sweep and matching
  controls; lower draw-call/geometry counts are established independently.
- The default optional 3D money font still uses Troika's remote resolver; failure
  degrades that decoration while the board atlas and transaction HUD keep working.

## Changed files

- Rules/actions: `src/store/useGameStore.ts`, `src/types/game.ts`,
  `src/game/soloRules.ts`, `src/game/soloAi.ts`.
- Live decisions: `src/App.tsx`, `src/components/ui/SoloDecisions.tsx`,
  `BottomActionDock.tsx`, `PropertyCard.tsx`, `src/board-v5.css`.
- Board/actors: `src/components/3d/Board3D.tsx`, `BoardTileDetails.tsx`,
  `boardTileAtlas.ts`, `AnimatedToken.tsx`, `TokensAndBuildings.tsx`, `Dice3D.tsx`.
- Confirmed feedback: `src/presentation/PresentationProvider.tsx`,
  `animationMath.ts`, `effectEvents.ts`, `src/components/3d/GameplayEffects.tsx`,
  `src/components/ui/GameplayFeedback.tsx`, `src/utils/audio.ts`,
  `src/online/onlineController.ts`.
- QA: `src/game/useSoloAudit.ts`, `src/components/3d/GraphicsAudit.tsx`,
  `tests/solo-rules.test.ts`, `board-v5.test.ts`, `animations.test.mjs`,
  `online.test.ts`, `tests/fixtures/board-catalog-main-v5.json`,
  `scripts/board-v5-{regression,resilience,review,report,baseline-rules}.mjs`.
- Delivery: `package.json`, `.github/workflows/ci.yml`, `.gitignore`, this report,
  its evidence and the rules audit. Pre-existing `.phase1-*` directories remain
  untouched and are excluded from the V5 commit.
