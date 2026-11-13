# 2D main menu

Opening the root URL renders the reference-inspired fantasy city illustration and React menu controls. No gameplay Canvas, HUD, renderer, board data, Solo store, socket client or model assets are in the initial module graph. The former live menu scene and its CSS have been removed.

## Screen boundaries

- `MainMenu.tsx` renders a decorative local JPEG with functional Play Solo, Play Online and Settings controls. Settings retains the existing graphics and audio preferences.
- `Application.tsx` dynamically imports `SoloGame.tsx` only for the explicit `#solo` route. This wrapper mounts the existing `App` and presentation provider. Returning home unmounts the Canvas; returning to Solo reuses the existing in-memory game store.
- Authentication and the lobby remain lightweight React views. `RoomScreen.tsx` loads the existing online controller only for a room or match route, and waiting rooms contain no renderer.
- `OnlineMatchScreen.tsx` is a second dynamic import. `ConfirmedMatch` renders it only after the existing controller receives a successful, authorized backend match snapshot. A pending or rejected match URL cannot load the renderer. Existing NestJS room start, authoritative actions, reconnect, results and active-match resume behavior are preserved.
- `?graphicsAudit` alone still opens the menu. Renderer audit scripts now explicitly navigate to `?graphicsAudit#solo`.

The gameplay map, board, AI, rules and backend production code are unchanged.

## Loading measurements

Production builds using the same local dependencies, measured as uncompressed JavaScript file bytes:

| Measurement | Before (`2348f97`) | After |
| --- | ---: | ---: |
| Initial JavaScript | 1,652,498 bytes | 194,143 bytes |
| Gameplay Canvas / WebGL contexts before start | Live menu scene | 0 / 0 |
| Gameplay chunk or heavy model requests before start | Eager renderer graph | 0 |

Initial JavaScript is reduced by approximately 88%. The menu image is 561,430 bytes, 1672 × 941 pixels. The real engine and game styles are deferred, rather than hidden behind an overlay. Vite's build manifest lets the browser tests identify the actual emitted gameplay chunks without relying on hashed filenames.

## Validation

Local production frontend served by the real NestJS backend, with an isolated PostgreSQL 16 database and two isolated Chrome profiles:

- `npm run build`: passed (TypeScript and Vite).
- `npm run test:menu`: 3 passed, including static import boundary and positive controls for both real game entry points.
- `npm run test:online`: 16 passed.
- `node --test tests/animations.test.mjs tests/graphics.test.mjs`: 29 passed.
- `npm run test:menu-browser`: passed at 1440 × 900, 390 × 844, 360 × 640 and 844 × 390. Verified fresh menu, image load, settings persistence, authentication navigation, no horizontal overflow, zero Canvas/context/gameplay requests, Solo mount, home unmount, and Solo state preservation.
- `npm run test:online-browser`: all 10 existing end-to-end scenarios passed, with zero uncaught browser errors. Additional assertions cover the menu, authentication, both lobbies, host/guest waiting rooms, a deliberately delayed real server snapshot, and an authenticated server-rejected match URL. Multiplayer synchronization, purchases, replay, reload, multiple tabs, socket recovery, private invitations, results and Solo AI all pass.
- `npm run test:graphics-browser`: passed. All 40 tiles remain visible and selectable at four screen sizes; camera controls, dice, purchase and end turn still work.

Browser scripts require a production build (`dist/.vite/manifest.json`) and a running backend serving `dist`. Set `ONLINE_TEST_URL` to that server and `CHROME_PATH` if Chrome is not at the Windows default. The graphics script uses `AUDIT_URL` instead. CI runs the build, unit checks, real two-player browser suite and responsive menu suite on Node.js 22.

Workstation detail: the installed Node version is 24.21.0; Windows Application Control blocks the native Rollup module. Local builds used the official matching `@rollup/wasm-node@4.68.3` through an ignored, local-only preload. No dependency, lockfile or production workaround was committed. GitHub Actions uses the repository's supported Node.js 22 and standard `npm ci` / `npm run build`.

Evidence:

- [Desktop menu](evidence/menu-1440x900.png)
- [Mobile menu](evidence/menu-390x844.png)
- [Landscape menu](evidence/menu-844x390.png)
- [Menu measurements and browser results](evidence/results.json)
- [Two-player browser results](evidence/online-results.json)
- [Existing board browser results](evidence/graphics-results.json)

## Artwork provenance and final prompt

Final asset: [`public/assets/menu/fantasy-city-menu.jpg`](../../public/assets/menu/fantasy-city-menu.jpg). Created using the built-in `image_gen` tool in edit mode, with the user's last attached fantasy castle / floating-island image as the primary edit target and reference. No CLI or external image API was used. The generated PNG was encoded as JPEG at quality 90 for delivery; no gameplay objects, UI, logos or words are baked into it. All menu controls and lettering are React DOM elements.

Exact final prompt:

```text
Edit the attached fantasy miniature-city image into a finished wide 16:9 decorative 2D background for a game main menu. The attached image is the PRIMARY EDIT TARGET and composition/style reference: preserve its premium colorful miniature diorama aesthetic, cream royal castle with saturated cobalt blue pointed roofs and gold accents on the left, cherry blossom framing upper left and lower corners, central plaza fountain and stone bridges, lush greenery and flowers, floating islands with distant small castles, tall turquoise waterfalls dropping through lavender and pink clouds, blue sky, warm peach sunset, distant purple mountain silhouettes, and the gold and lavender fantasy airship at upper right. Preserve the camera angle and broad left-castle/right-open-sky composition as closely as possible. REMOVE ALL board-game objects: no Monopoly board, no property tiles, no dice, no top hat/token, no chance or chest cards. Replace the removed lower-left props with blossom-covered gardens and foliage; replace the removed lower-right board with clouds and a distant floating garden. Remove the airship's text banner and all logos, words, lettering and labels. Leave the middle right sky/cloud area calm enough for functional React menu buttons overlaid separately. This must be one gorgeous polished static illustration only, no UI panel, no buttons, no HUD, no characters, no text, no watermark. Keep rich sunlight, inviting storybook colors, beautiful readable castle silhouettes, waterfalls and floating islands. Output a landscape image suitable for a full-screen website background.
```
