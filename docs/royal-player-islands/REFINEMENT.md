# Royal player island refinement

The island centers, chain attachments, and **7.507 × 7.502** world-unit shorelines match [the baseline](README.md). The statue scale and GLBs are shared with that release. The slate undersides deepen from **2.54** to **3.89–3.90** units. Connected rock shoulders, tapered shelves, and asymmetrical bedrock give the underside more volume.

Each monument has four levels of ivory and beveled gold, a recessed enamel frieze, embossed crowns and fleurs-de-lis, laurel sprigs, gemstone settings, and a baked contact shadow derived from its statue. The five alternating gold links have a **17% thicker** tube and riveted shield mounts. The scene reads the player's live color for banners, friezes, stones, plaques, and receiving glints. Landscaping uses low shrubs, paving, lanterns, and flower beds.

| Seat | Board edge | Statue | Default color |
| --- | --- | --- | --- |
| 1 | East | Griffin | Golden yellow |
| 2 | North | Unicorn | Rose pink |
| 3 | West | Carriage | Royal blue |
| 4 | South | Pegasus | Emerald green |

## Mint and treasury

Copper $1, $5, and $10, silver $20, $50, and $100, and gold $500 and $1,000 share one color atlas and a single-channel relief atlas. The meshes have recessed stamped faces, beveled rims, and milled edges. Obverse and reverse have their own readable amounts, heraldry, and UVs. The local scene art follows the user-supplied Royal Fantasy Coin Asset Sheet and island reference.

Each treasury greedily decomposes its authoritative whole-dollar balance. Every stack keeps its exact denomination count in the presentation data. At most five pieces of each value render, with taller stacks represented by larger spacing. In each world, a single instanced pool shares the eight coin batches across all four treasuries. The plaque counts toward the latest displayed target over 420 ms, and its frame and name are cached while the value changes.

## Confirmed payments

Solo batches balance writes and their new log receipts over the same microtask. Online uses the presenter's committed receipts and settled player snapshots. The scene reconciles both ends against observed balance movement, retains offsetting transactions, and falls back to a local coin effect for a balance delta that lacks a matching receipt. A restart or snapshot installation clears pending visuals and immediately loads the authoritative balances.

Directed payments use eased perimeter paths that clear the board. The sender receives a debit sign and short amber pulse when the coins leave. Coin arrival updates the recipient's treasury and starts the plaque counter and seat-colored glint. Bank transactions move coins locally to or from the affected treasury. Reduced motion shows steady signed labels and applies the visual balances immediately. Low quality drops trails and caps each flight at four coins, compared with seven at balanced and high. The scene retains at most ten recent transfer effects.

## Rendered comparison

- [Before overview](refinement/before-overview.jpg) · [Refined overview](refinement/after-overview.jpg) · [Overhead](refinement/overhead.jpg) · [Phone overview](refinement/mobile-overview.jpg)
- [Original and refined Griffin at the same camera position](refinement/after-griffin-matched.jpg) · [Original close view](refinement/before-griffin.jpg)
- [East](refinement/east-island.jpg) · [North](refinement/north-island.jpg) · [West](refinement/west-island.jpg) · [South](refinement/south-island.jpg)
- [Monument moulding and frieze](refinement/pedestal.jpg) · [Chain and anchors](refinement/chain-anchors.jpg) · [Every coin face and reverse](refinement/coin-obverse-and-reverse.png)
- [GO gain](refinement/go-money-gain.jpg) · [Property purchase loss](refinement/purchase-money-loss.jpg) · [Simultaneous two-way trade](refinement/simultaneous-transfer.jpg) · [Settled treasuries](refinement/settled-treasuries.jpg) · [Trade recording](refinement/two-way-transfer.webm)
- [Online rent on the desktop client](refinement/online-rent.jpg) · [Desktop and phone transaction results](refinement/online-rent.json)

## Performance

The production comparison used Chrome with an AMD Radeon 610M, a 1440 × 900 viewport, balanced quality, and normal motion. Each overview sample ran for 1.25 seconds. Each 1.7-second trade sample started with acceptance of the same $500 and $35 two-way trade. FPS is the reciprocal of median frame time. [Complete browser measurements](refinement/validation.json)

| Scene | FPS | Median frame | 95th-percentile frame | Median draw calls | Median triangles | Textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PR #88 overview | 54.3 | 18.4 ms | 26.1 ms | 237 | 982,191 | 31 |
| Refined overview | 65.8 | 15.2 ms | 18.1 ms | 251 | 1,002,175 | 36 |
| PR #88 two-way trade | 56.2 | 17.8 ms | 31.6 ms | 247 | 985,083 | 34 |
| Refined two-way trade | 67.1 | 14.9 ms | 41.6 ms | 269 | 1,004,439 | 41 |

Idle geometry attributes rose from 22.1 to 22.9 MiB and instance attributes from 0.10 to 0.12 MiB. The mesh-texture estimate rose from 24.8 to 33.1 MiB at RGBA-equivalent sizes, which overstates the single-channel relief atlas. These estimates cover collected mesh resources. Driver VRAM was unavailable. Median frame time improved in this run. The refined trade had longer slow frames, with 95th-percentile frame time increasing by 10 ms.

## Verification

The production browser suite compares the exact shore and statue bounds, checks all forty tile centers in overview, and verifies treasury updates after real Solo actions. It trades $500 and $35 in opposite directions, then records a GO salary and property purchase. Browser checks also verify reduced-motion settlement and silent reload. Unit tests cover denomination and stack limits, route clearance, expiry and cleanup, stable seats, receipt reconciliation, auction, mortgage, tax, card, and bankruptcy payments.

A loopback Socket.IO match backed by the multiplayer rules engine confirmed that desktop and phone clients both saw the same four $1 rent coins move from the payer to the recipient. Both clients settled to $1,496 and $1,504 with all four islands clear of the HUD. Hosted deployment was outside this verification run.

`npm run lint`, `npm run build`, `npm run test:solo`, `npm run test:online`, `npm run test:graphics`, `npm run test:animations`, the seven focused player-island tests, and the Arcade browser suite passed. The separate V6 graphics suite reproduces the same ownership-rail assertion on the baseline and the refinement, with four markers against an expected two.

Run `node scripts/player-islands-refinement-browser.mjs` with production previews on ports 5215 for the refinement and 5217 for the baseline. The script accepts `ISLANDS_REFINEMENT_URL`, `ISLANDS_BASELINE_URL`, and `ISLANDS_REFINEMENT_OUT` for alternate preview and capture locations.

## Implementation files

- [Island scene and live colors](../../src/components/3d/PlayerIslands3D.tsx) · [Terrain, monument, and chain meshes](../../src/components/3d/playerIslandGeometry.ts) · [Balance plaques](../../src/components/3d/IslandPlaque.tsx)
- [Coin models and atlases](../../src/components/3d/royalCoinMeshes.ts) · [Denominations](../../src/components/3d/royalCoinValues.ts) · [Treasury renderer](../../src/components/3d/IslandTreasury.tsx) · [Instance pools](../../src/components/3d/RoyalCoinInstances.tsx)
- [Receipt reconciliation](../../src/presentation/islandMoney.ts) · [Settlement timing](../../src/components/3d/useIslandTreasuryMotion.ts) · [Flight paths](../../src/components/3d/islandMoneyMotion.ts) · [Money effects](../../src/components/3d/PlayerIslandMoney.tsx)
- [Graphics audit](../../src/components/3d/GraphicsAudit.tsx) · [Production browser suite](../../scripts/player-islands-refinement-browser.mjs) · [Solo tests](../../tests/player-islands.test.ts) · [Online tests](../../tests/online.test.ts)
