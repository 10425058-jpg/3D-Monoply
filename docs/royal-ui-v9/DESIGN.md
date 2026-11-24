# Royal popup design system

## Visual language

Use violet surfaces, a double brass border, a title ribbon and small corner ornaments for blocking decisions. Use parchment for deeds and card instructions. Each player’s avatar uses the color from the game state. Preserve property-group colors on deeds, trade terms and development panels.

| Token | Value | Use |
| --- | --- | --- |
| `--ui-deep` | `#281638` | Deep violet surfaces and form controls |
| `--ui-purple` | `#3d2050` | Secondary surfaces |
| `--ui-plum` | `#54305f` | Raised panels and interaction feedback |
| `--ui-gold` | `#d8ad62` | Frame, borders and ornaments |
| `--ui-bright` | `#ffe29b` | Titles, focus and bid values |
| `--ui-paper` | `#fff0d0` | Default copy |
| `--ui-muted` | `#d7c4df` | Supporting labels and disabled copy |
| `--ui-green` | `#65e8ad` | Balances, gains and completed rewards |
| `--ui-ruby` | `#f597a6` | Debt, shortfalls and elimination |

Headings use Cinzel with a Georgia fallback. Descriptions and controls use DM Sans with a system fallback. Use tabular figures for cash values. Pair semantic colors with text, icons or status labels.

## Components

| Component | Use |
| --- | --- |
| `RoyalModal` | Native dialog with an accessible title, optional description and one active top-layer surface. Provide `footer` for actions that must stay available while the body scrolls. |
| `RoyalPresence` | Retains a closing surface for 150 ms. Match decisions and results take priority over utility dialogs. |
| `RoyalButton` and `RoyalIconButton` | Gold primary, outlined secondary, ruby danger and emerald success variants. Use the disabled attribute for unavailable actions. Give icon buttons an accessible name. |
| `RoyalPanel` and `RoyalNotice` | Inset content and semantic feedback. Announce errors and changes with the appropriate live-region role. |
| `RoyalTabs` | Includes a tablist, labelled panels, roving keyboard focus and arrow, Home and End navigation. |
| `RoyalArt` | Decorative sprites for auction, vault and deck illustrations. Functional copy stays in the DOM. |

Use widths up to 480 px for short confirmations, 650 px for medium decisions, and 880 px for trade, auction, results and other wide layouts. Dialogs use the available width on phones, with a bounded content area and wrapping buttons. Standard dialog buttons use a 44 px minimum height. Side inspectors use the same typography and controls while leaving the board interactive.

## Behavior

- The active dialog holds keyboard focus and makes the rest of the page inert. Focus returns to the opener when it remains mounted. Optional dialogs supply a close handler. Mandatory decisions leave it unset. A pending room operation also leaves it unset.
- The frame and backdrop enter in 210 ms and exit in 150 ms. Reduced motion skips these animations. The backdrop uses a single translucent color.
- Dice results use a compact receipt. Purchases, rent, upgrades and GO income use the existing notice queue. Cards, railroad payouts and elimination use centered announcements. Blocking decisions take precedence over notices.
- Solo properties and Online inspector cards remain available during free orbit. Camera position stays with the existing scene controller.

## Artwork

`src/assets/royal-props.webp` is an original ImageGen atlas created for V9. It contains a gavel, closed vault, Chance cards and a Community Chest. The transparent WebP is 768 × 768 and 184,790 bytes. The Miniature City portraits and property-stage illustrations come from the repository.
