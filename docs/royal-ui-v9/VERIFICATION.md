# V9 verification

## Automated checks

| Check | Result |
| --- | --- |
| `npm run lint` | Passed TypeScript checking. |
| `npm run build` | Passed the production build. |
| `npm run test:solo` | 80 tests passed. Includes rules, auctions, railroad bonuses, Arcade tiers, activity and player islands. |
| `npm run test:online` | 27 tests passed. |
| `npm run test:menu` | 4 tests passed. |
| `npm run test:animations` | 22 tests passed. |
| `npm run test:board-browser` | Passed in the production build. Includes dice and token movement, purchase, sale and mortgage paths, card chains, Jail, debt, bankruptcy, victory, restart and context recovery at all graphics tiers. |
| `npm run test:arcade-browser` | Passed. Includes purchase and three development stages, AI card reveals, notifications, and a 390 px property action. |
| `node scripts/royal-ui-browser.mjs` | 37 dialog checks passed across six viewport sizes. [Responsive evidence](evidence/responsive.json) covers popup geometry, live choices, focus return, mandatory Escape handling, reduced motion, camera drag shielding and modal priority. |
| `node scripts/menu-browser.mjs` | Passed four viewport checks. The menu loaded zero gameplay requests and created zero WebGL contexts before entering Solo. |
| `node scripts/online-browser.mjs` | [10 real Online browser scenarios passed](evidence/online.json). Includes room creation, join pending and error feedback, private-code rotation, live turn handoff, reconnect, forfeit and standings. |

The baseline and V9 each fail one assertion in `test:graphics-v6`. The ownership-rail test expects two rails and sees four in both runs. The other 22 tests in the graphics command passed before it reached the animation subcommand. The animation suite passed when run directly.

Browser checks used Chrome on Windows with a 390 × 844 emulated touch viewport. Online tests used the built frontend, NestJS and disposable PostgreSQL. The Node runtime was 24.21.0. Private invite text is masked in the evidence.

## Performance

See the [matched settings measurements](evidence/performance.json). The comparison uses the same 1440 × 900 low-quality Solo board and three 2.3-second runs per build. On the Radeon 610M, the middle of the three run medians was 8.7 ms on the baseline and 7.3 ms on V9. Draw calls were 232 in both builds. Per-run 95th percentiles ranged from 10.8 to 19.1 ms on the baseline and 8.1 to 26.2 ms on V9. The short runs showed variation in frame times. Menu startup JavaScript measured 194,980 bytes on the baseline and 199,967 bytes on V9, within the repository's 250 KB budget.

## Reproduce the popup checks

Run the Vite server on loopback, then start the popup script from the repository root. Set `CHROME_PATH` if Chrome is installed in a different location.

```powershell
npm run dev -- --host 127.0.0.1 --port 5189
```

```powershell
node scripts/royal-ui-browser.mjs
```

## Changed files

| Area | Paths |
| --- | --- |
| Shared system | `src/components/ui/RoyalUI.tsx`, `src/components/ui/royal-ui.css`, `src/components/ui/royal-surfaces.css`, `src/assets/royal-props.webp` |
| Solo routing and surfaces | `src/App.tsx`, `src/components/ui/SoloDecisions.tsx`, `src/components/ui/PropertyCard.tsx`, `src/components/ui/PropertyEvolution.tsx`, `src/components/ui/TradeTerms.tsx`, `src/components/ui/CardReveal.tsx`, `src/components/ui/StatsModal.tsx`, `src/components/ui/ActivityLog.tsx` |
| Menu and Online | `src/Application.tsx`, `src/online/components.tsx`, `src/online/OnlineMatchScreen.tsx`, `src/online/online.css`, `src/menu/main-menu.css` |
| Existing layout and style | `index.html`, `src/app-ui.css`, `src/board-v5.css`, `src/fantasy-hud.css`, `src/game-effects.css`, `src/components/ui/match-activity.css`, `src/components/ui/property-evolution.css` |
| Browser verification | `scripts/royal-ui-browser.mjs`, `scripts/arcade-v8-browser.mjs`, `scripts/board-v5-regression.mjs`, `scripts/gameplay-v7-evidence.mjs`, `scripts/online-browser.mjs`, `scripts/player-islands-refinement-browser.mjs` |
| Documentation and captures | [V9 documentation and evidence](README.md) |

The focused `test:rules-online-browser` scenario passed the mobile Utility card instructions and committed the purchase. Both builds timed out waiting for the purchase receipt after the fixture reload. The main Online browser suite passed its separate live-match and committed-state scenarios.
