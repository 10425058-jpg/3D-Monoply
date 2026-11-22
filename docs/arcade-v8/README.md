# Arcade Property Evolution and Match Activity

New Solo matches start in Arcade. To choose Classic, open **Game Settings & New Game**, choose **Classic**, then enter the city. In Arcade, buy an unowned street and use **Build** or the upgrade prompt to inspect its stages and pay for the next upgrade. The evolution panel shows the current stage, each stage’s rent, and the next upgrade price.

## Rules and economy

| Stage | Charge to reach it | Rent index in the printed street catalog |
| --- | --- | --- |
| 0 · Land | Printed purchase price, or the final bid at auction | `rent[0]` |
| 1 · House | `1 × houseCost` | `rent[1]` |
| 2 · Apartment | `2 × houseCost` | `rent[3]` |
| 3 · Hotel | `3 × houseCost` | `rent[5]` |

Arcade enables a single paid increase on the player's own street per resolved landing. Buying directly can open that window immediately. Later visits, including eligible card-directed landings, open a new window. The active lander can use the window after winning their property's auction. The engine validates the owner, landing ID, activity phase, current stage, mortgage status, and cash before committing the price and stage together. Arcade charges the configured Land rent for a complete color group.

Arcade sells one stage at a time for half of that stage's fee, rounded down. A street can be mortgaged at Land, and clear deeds carry their development through trades. Bankruptcy liquidates developed stages and hands the creditor Land, or returns the deed to the Bank when there is no creditor. Repair cards count a House as one house, an Apartment as three houses, and a Hotel as one hotel. Railroads and utilities use their existing rent rules.

Classic uses the existing `houses` count, full color groups, even building and selling, and the original undeveloped rent and mortgage rules. Arcade uses a separate `developmentLevel` and a serialized landing ID with a consumed flag. A restored state without `ruleset: 'arcade'` uses Classic. This repository persists Solo meta progress, while its match state and 160-entry activity history live in the active browser session. Online continues to use `mini-v1` with its original action set.

## Activity and notifications

Solo builds typed activity from confirmed engine outcomes for every human and AI seat. Online reads authorized, public records from the existing server event log. Snapshots carry a cursor over committed sequences. The frontend groups cash entries into logical transactions and uses stable event IDs to deduplicate repeated snapshots and action deliveries.

Rent has a single ledger entry with both parties, the deed, amount, and known balances. A resolved card displays its public instructions, confirmed transfers, and linked outcomes such as movement or passing GO. Linked rent, salary, and taxes keep their own transaction entry. The feed keeps the latest 160 normalized records per match, including bankruptcies and results.

Match Activity supports category and player filters, keyboard navigation, expandable receipts, and a jump to the latest entry. Selecting **Important only** limits temporary notices. Browser motion preferences apply to notices and construction. Online can restore recorded history after refresh through the V8 backend. Restored history stays quiet. Earlier server data can only restore the events it recorded.

## Blender assets and rendering

[The Blender generator](../../tools/blender/generate_arcade_properties.py) produces the four original models and the Property Evolution previews from the same geometry. The stage models share a 128-pixel palette atlas. The front of each model faces along its tile transform, and the pennant carries the owner's color. Each visible stage batches instances by material.

| Model | Design | Triangles | GLB bytes |
| --- | --- | ---: | ---: |
| `land.glb` | Fenced garden plot with an estate entrance | 1,794 | 159,180 |
| `house.glb` | Ivory cottage with gables and amber windows | 2,970 | 257,208 |
| `apartment.glb` | Multi-floor residence with balconies and dormers | 4,338 | 372,312 |
| `hotel.glb` | Grand entry, blue dome, and flanking towers | 5,403 | 429,660 |

The board renders the committed stage throughout the match. A live purchase or upgrade plays a short, property-scoped construction reveal. The hotel has a longer particle and ring effect. A restored stage renders in its settled pose. Each model has a stage-specific loading fallback. The [asset manifest](../../public/assets/models/arcade-properties/manifest.json) records authorship, licensing, bounds, and hashes. The board catalog, tile order, central castle, and fantasy scenery use their existing assets and geometry.

## Browser evidence

The images come from Chromium gameplay on the running app. Solo QA fixtures set starting positions, balances where needed, and deck order. Purchases, upgrades, rent, and card results then use the regular game actions. Online evidence used actual NestJS, PostgreSQL, and Socket.IO with deterministic server-side rolls.

| Scenario | Capture |
| --- | --- |
| Unowned street and purchased Land | [Unowned](evidence/01-unowned.jpg) · [Purchase and Land](evidence/02-purchased-land.jpg) |
| Construction and completed stages | [Construction](evidence/03-house-construction.jpg) · [House](evidence/04-house.jpg) · [Apartment](evidence/05-apartment.jpg) · [Hotel](evidence/06-hotel.jpg) |
| Solo Match Activity and AI outcomes | [History](evidence/07-match-activity.jpg) · [Chance](evidence/08-chance.jpg) · [AI Community Chest](evidence/09-community-chest-ai.jpg) · [AI rent](evidence/10-rent-and-ai.jpg) |
| Board orientation and mobile | [Four board sides](evidence/four-sided-property-gallery.png) · [Mobile upgrade](evidence/12-mobile-upgrade.jpg) · [Mobile activity](evidence/13-mobile-activity.jpg) |
| Online public activity | [Chance](evidence/online-chance-live.png) · [Community Chest](evidence/online-community-chest-live.png) · [Two-player rent](evidence/online-two-player-rent.png) · [Four-player history](evidence/online-four-player-feed.png) · [Mobile Online](evidence/online-feed-mobile.png) |

The [Solo report](evidence/solo-results.json) contains the exact upgrade amounts, committed card and rent records, frame timing summaries, and mobile layout measurements. The [graphics report](evidence/property-graphics.json) records each stage's position, owner tint, shadow profile, and forced Hotel fallback. The [Online report](evidence/online-results.json) records matching two- and four-player histories and quiet refresh. See the [Online browser regression](evidence/online-regression-results.json) and [rules browser regression](evidence/online-rules-results.json) for the established paths.

### WebGL measurements

The production Chromium run compared four Arcade lots with an empty board in the same Balanced scene at 1672 × 941 on AMD Radeon 610M. The four lots contributed 18 batched meshes and 14,505 model triangles with one shared atlas. The readings include the whole board and environment. This run overlapped the legacy browser regression. A separate run measured 17.4 ms median frame time in both configurations.

| Metric | Empty board | Four Arcade lots |
| --- | ---: | ---: |
| Median frame time | 18.50 ms | 17.70 ms |
| P95 frame time | 33.40 ms | 23.00 ms |
| Median CPU render time | 4.90 ms | 5.20 ms |
| Median GPU frame time | 16.41 ms | 15.84 ms |
| Median draw calls | 206 | 227 |

This measurement covers one desktop GPU and viewport. The mobile browser run covered layout and interactions.

## Verification commands

The local run passed 72 Solo, 24 Online, 33 model and animation, 14 camera layout, four menu bundle, and 21 environment asset checks. The backend passed 59 rule and session checks plus 14 live PostgreSQL integration cases. The focused Solo, graphics, and two- and four-client Online scenarios also passed in Chromium.

- `npm run build`, `npm run test:solo`, `npm run test:online`, `npm run test:graphics-v6`, and `npm run test:graphics`
- `npm run dev -- --host 127.0.0.1 --port 5198`, then `npm run test:arcade-browser` and `npm run test:arcade-graphics-browser`
- `npm run test:board-browser` with `V5_TEST_URL` pointing to the app
- In `backend/`, `npm run build`, `npm test`, and `npm run test:integration` against a migrated test database
- `npm run test:arcade-online-browser` with `DATABASE_URL` pointing to a migrated disposable local PostgreSQL database and both frontend and backend built

To rebuild the assets, run Blender in background mode with `--python tools/blender/generate_arcade_properties.py`. The browser graphics run checks Low, Balanced, High, and an interrupted Hotel asset download.
