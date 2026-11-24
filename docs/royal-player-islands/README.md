# Royal player islands

Each board edge has a grassy slate island with a glazed statue, a short gold chain, a live balance plaque, and minted coin stacks. The islands are centered on the four edge midpoints at the same distance from the board center. Their shared footprint measures **7.507 × 7.502 world units**, about **29.6%** of the 25.4-unit board side. Shores and statues grew by **24%** from the first layout. The chains span **1.79 units** along each edge's outward axis.

| Slot | Edge | Statue |
| --- | --- | --- |
| 1 | East | Royal Griffin |
| 2 | North | Royal Unicorn |
| 3 | West | Royal Carriage |
| 4 | South | Royal Pegasus |

The landmarks follow the default royal themes in the reference composition. Each island uses the scene's stable seat ID for its current player and balance, including when the player changes their gameplay token. Vacant slots display “Open seat.”

## Currency and presentation

- Copper coins carry $1, $5, and $10. Silver carries $20, $50, and $100. Gold carries $500 and $1,000. The beveled 3D meshes share a 1024 × 512 face-and-edge atlas with denomination, crown, laurel, and milled-edge details.
- The scene reads settled balance deltas in Solo and reconciles Online transfer receipts against the authoritative presented balances. This preserves both credit and debit from compound commits, including a GO salary and an offsetting tax. Starting and restored balances load quietly.
- The currency pool shows up to seven coins per cue, or four on low quality. It selects the largest useful denominations first and always displays the exact signed amount. Reduced-motion mode presents a steady label and glow.

## Assets and performance

Terrain, grass, shrubs, plinths, chains, flags, lamps, and coins are authored in the scene. The statue GLBs derive from the project's [original royal token assets](../royal-player-tokens/README.md). The [Blender export script](../../tools/blender/royal_tokens/export_island_statues.py) simplifies the four silhouettes and groups their materials into two draws each. The four exports total 33,098 triangles and 878,292 bytes.

Static props are batched by finish and culled per island. Coin stacks share one mesh and material, and active coins use a reusable instance pool. In three repeated 96-frame Chrome samples at 1440 × 900 on a Radeon 610M, median frame times ranged from 10.3–10.6 ms with the islands and 12.2–12.5 ms on the baseline board. Median draw calls rose from 191 to 235. [Frame timings](evidence/frame-timings.json) · [Browser validation](evidence/validation.json)

## Verification

The production browser check projects the island meshes and plaques and compares their screen bounds with the HUD and routine rent receipts. It checks the 40 tile centers in desktop and mobile overview and verifies mouse and touch selection. A Solo rent payment shows matching gain and loss labels, moving minted coins, and the updated balances. The automated suites cover GO salary, card rewards, tax, auction settlement, trade, mortgages, bankruptcy, and committed Online receipts.

Two Online Chrome clients also displayed the same signed rent change and updated balance plaques using a loopback Socket.IO fixture backed by the game's rules engine. [Online capture](evidence/online-rent.jpg) · [Client results](evidence/online-rent.json)

- [Desktop overview](evidence/overview.jpg)
- [Overhead](evidence/overhead.jpg)
- [Gameplay angle](evidence/gameplay-angle.jpg)
- [Mobile overview](evidence/mobile-overview.jpg)
- [Statue and coins](evidence/statue-and-coins.jpg)
- [Rent transfer](evidence/rent-transfer.jpg)

Run `npm run lint`, `npm run test:solo`, `npm run test:online`, and `npm run test:graphics` for the automated checks. With a production preview on port 5195, run `node scripts/player-islands-browser.mjs` to repeat the browser check. Pass `--layout-only` to review the proportions and framing.
