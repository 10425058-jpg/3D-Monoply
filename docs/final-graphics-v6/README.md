# Final graphics overhaul V6

The existing floating fantasy city is preserved. This pass improves the physical board, authoritative dice presentation, token separation, material coherence and HUD precision while reducing repeated rendering work. It starts from `origin/main` at `2773eaf` (merged rules remediation PR #58), on `feature/final-graphics-overhaul-v6`. There were no open PRs at inspection; the two existing graphics worktrees were left untouched.

## Board

- Stronger ink contrast and larger property/pricing type in the existing shared 1024² atlas; 16× anisotropy where supported and inset UV cells. No per-tile textures or network font dependency.
- Corner artwork compensates for its square physical surface, avoiding stretched medallions and lettering. Chance and Chest have distinct, restrained deck accents.
- Player-colored side rails complement numbered owner seals; the mortgage seal and muted surface remain separate. Rails never cover names, prices or color bands.
- Gold selection, ivory hover, lavender auction, turquoise affordable purchase and blue occupied outlines have explicit priorities. Purchase color reflects the committed owner and available cash. The forty-space catalog, prices, group colors and physical transforms are unchanged.

Primary files: `BoardTileDetails.tsx`, `boardTileAtlas.ts`, `boardVisualState.ts`, `Board3D.tsx`.

## City and world

- Existing central GLB materials retain their atlas and authored colors, with matte limestone, satin blue slate, restrained brass and less blown-out window emission.
- Fountain pools get small moving normal highlights without reflection passes; decorative spray is suppressed with reduced motion.
- The optional legacy city now has horizontal basin/plaza/ripple rings, water above solid basin caps, and jets that remain at their nozzle origin. Its crystal, flags, trees and water respect motion/visibility preferences.
- Surrounding islands, waterfalls, castles, windmills, airship, sun, clouds, mountains and world composition remain intact; no asset was regenerated and no new background prop was added.

Primary files: `CenterCity3D.tsx`, `castle/finishCastleMaterial.ts`, `castle/RoyalCityEffects.tsx`, `castle/CentralPlazaFountain.tsx` and legacy motion guards.

## Presentation and HUD

- Fixed both dice being scaled to zero during their rolling phase. Rest rotations and random-number generation are unchanged. The browser matrix verifies all six values on both dice, rapid clicks, consecutive doubles, third-double Jail, and resets in both motion modes.
- Compact enamel token rings remain distinct with four to six co-located players. Resets clear facing and trails. Hotel roof, eaves, windows and doorway now meet the actual wall body.
- Purchase/build pulses use the confirmed owner's color; mortgage feedback uses lavender. GO pulses reuse a positive committed receipt without creating a second payment or reward. Existing exact transaction notices remain.
- Refined player/card materials, Landmark hierarchy, disabled actions, circular Roll busy label and keyboard focus. Chance/Chest use distinct icons and accents; victory retains the existing result/navigation architecture.
- Fixed Main menu covering Settings on phones, wide-screen player-panel/dock contact, and clipped shortcuts in short landscape. Six-player scrolling and all existing actions/navigation are preserved.

Primary files: `Dice3D.tsx`, `AnimatedToken.tsx`, `TokensAndBuildings.tsx`, `GameplayEffects.tsx`, `presentation/animationMath.ts`, `presentation/effectEvents.ts`, UI components and `fantasy-hud.css` / `game-effects.css`.

## Rendering efficiency and evidence

114 static ornaments now use seven instanced draws with the same primitive tessellation, colors, materials, transforms and shadows. Owned resources and instance buffers have explicit cleanup. No postprocessing pass, texture or GLB asset was added. Low/Balanced/High retain gameplay information.

In three alternating Balanced gameplay pairs, median draw calls fell 370 → 199 and render CPU time 2.5 → 1.5 ms. Median FPS was comparable (91.7 → 89.9, overlapping run ranges); texture counts remained 18. The report includes the noisier initial sample as well as all six follow-up runs.

See [measured performance](PERFORMANCE.md) and [paired screenshots and gameplay evidence](SCREENSHOTS.md). The before build was frozen before editing; final A/B measurements use identical production workloads, camera, fixture, quality, seed and rendering conditions.

## Verification

- TypeScript (`npm.cmd run lint`) and production build: passed.
- 72 rule/catalog/online-adapter/V6 board/material tests: passed.
- 68 existing graphics, animation, environment, actual-GLB asset, central-city and menu tests: passed.
- Existing Solo browser suite: passed opening, six rendered dice pairs, purchase/rent, houses/hotel, ownership/mortgage, Jail, both card decks/card chains, debt, auction, bankruptcy, victory, AI round, reset and four identical remount cycles. No resource growth or browser errors.
- Dedicated rendered dice suite: 20 cases passed, including the full paired face/motion matrix, rolling visibility, duplicate-click rejection, consecutive doubles and reset cancellation.
- Responsive HUD: six requested viewport sizes, all six player cards accessible, real control hit tests, no horizontal overflow, busy label fit and both mobile card reveals/resolution passed.
- Existing graphics browser audit: all forty spaces pickable and unobstructed at four viewport sizes, including real mouse/touch actions; camera presets, top view, orbit, zoom and a legal purchase passed.
- Context loss/restoration: all three quality tiers restored the sampled board pixels identically. Normal token/dice movement and optional 3D font failure with preserved transaction HUD passed.
- Forced central-model failure: real fallback, forty clear tiles, water/spray placement, live motion/hidden-tab behavior, selection, roll/purchase and cleanup passed. Deliberately injected GLB errors are recorded separately; no unrelated errors.
- Eight existing focused rules browser scenarios passed, including accepted/rejected debt trades, $11 auction settlement, Landmark costs/GO income, six-player access and utility card instructions.
- New pure graphics tests are added to the existing CI build job; existing checks are preserved.

Reproduction scripts: `final-graphics-v6-review.mjs`, `final-graphics-v6-dice.mjs`, `final-v6-hud.mjs`, `final-v6-fallback.mjs`, plus the existing `board-v5-regression.mjs`, `board-v5-resilience.mjs`, `graphics-regression.mjs`, and `rules-audit-browser.mjs`. Supply each script's URL/output environment variable to use another loopback production server. `npm run test:graphics-v6` runs targeted invariants and animation tests.

## Limits

- Local hardware measurements are from one AMD Radeon 610M/Windows Chrome session; they are short samples and do not establish a universal 60 FPS guarantee. Node on the local host is 24.21.0; the unchanged CI runtime is Node 22.
- Live authenticated multiplayer end-to-end verification was not run locally: no backend was listening on loopback port 3000. The 17 existing online adapter/security/lifecycle tests pass; the existing real Chrome/two-player/PostgreSQL CI job remains enabled for the PR.
- Labels naturally become small in a whole-board phone view; existing property focus/cards and zoom remain available. No camera/navigation behavior was replaced.
- The existing lazy gameplay chunk and optional Troika money-label font dependency remain. Its failure path was exercised and does not hide committed transaction feedback. Texture allocation figures are estimates, not driver VRAM.
- No prolonged multi-hour soak, physical mobile-device GPU test, or cross-browser certification is claimed. Repeated resets/remounts and identical workload allocation checks passed.

Gameplay rules, Solo AI, backend/API behavior, authentication, schemas, online authority/synchronization, prices, rent, buildings, rewards and progression are preserved. No merge is performed.
