# Gameplay and game feel V7

Baseline commit `3e831f095c6078f5ef5f82e4f19f148d6549a916` was the remote `main` when the branch was created. The comparison uses the existing board and camera controls in both builds.

## Gameplay changes

| Interaction | Before V7 | V7 |
| --- | --- | --- |
| Dice | Ivory dice spun in place, with a separate bounce after the result | A brief windup, distinct ivory and blue dice, controlled throws and diminishing bounces. The rendered top faces and HUD result come from the committed pair. |
| Token movement | Solo hopped between steps. Online inferred a route from the final tile and could skip card redirects. | Hops follow each space and its height, with player-colored motion and landing feedback. Online follows ordered server move events, including backward cards and direct Jail moves. |
| Purchases and ownership | Generic ownership notice and a separate balance delta | Property, price, payer, bank and resulting cash in one receipt. The committed deed marker pops and remains visible after the effect. |
| Rent and Bank payments | Signed popups and an activity sentence could describe the same payment | Directional receipt with the reason, amount and committed balances. GO, rent, construction, cards, mortgages, auctions, trades and bail use the existing economy. |
| Cards | Shared reveal treatment with a single resolve control | Each deck keeps its own styling, and the card shows its effect category. The resolve button takes keyboard focus and is bound to the current draw. Chained cards resolve individually. |
| Construction and Landmark | Buildings appeared with a simple pop. Landmark controls already showed cost and GO income. | Houses rise into place, hotels have their own silhouette and upgrade receipt, and sales show the actual refund. Landmark success includes the committed level and GO bonus. |
| Auctions and trading | Auction terms were a few sentences. Trade terms were spread across the form. | Opening price, high bid, minimum and bidder liquidity are visible together. Both sides of a trade show the deeds, restrictions, color-group completion and cash after the exchange. |
| Turn flow | An expiring turn banner competed with transaction notifications | A persistent cue identifies the player and next action, including the Solo extra-roll handoff. Online shows when the client is waiting for a response, animating, or reconnecting. |
| Jail, bankruptcy and victory | Generic alerts and minimal final results | Jail cues distinguish entry, failed rolls and release. Bankruptcy identifies the obligation and where eligible assets go. Results include final cash and deeds, server rankings where available, and an exit or replay path. |
| Audio | Several events shared the same motif and could sound twice during synchronous updates | Original synthesized cues for dice, movement, rent, bids, trade, construction, Jail, elimination and victory. Synchronous updates select one cue, and the existing mute and volume controls apply. |

## Solo AI and Online authority

Solo AI uses public deed ownership and cash when choosing purchases, legal bids, construction and debt recovery. It chooses a railroad vault from the three visible options with equal probability. Jail decisions use the same actions available to a human. The existing incoming trade evaluation remains in place. The setup screen currently presents a fixed AI lineup, so difficulty tiers are a separate follow-up.

Online `mini-v1` decisions come from `allowedActions`. The server commits dice, positions, cash, cards, ownership and outcomes. Consecutive snapshots can play their committed event sequence at a personal 1× or 2× pace. The client filters stale versions and synchronizes to the authoritative state on a gap or reconnect. Restoration shows current ownership, the last dice readout and any resolved card quietly.

Source comparison against `main` confirms matching board geometry, catalog and tile order, central castle, floating islands and scenery, menu, authentication, database schema, and Render settings. The update uses the existing navigation, rules, dice RNG, and backend endpoints.

## Browser evidence

The captures use the running production builds and existing loopback Solo QA fixtures with real gameplay actions. The motion sequence consists of Chrome DevTools screencast frames. The corresponding post-render observations identify the dice faces and token route.

- [Baseline captures](evidence/before/) and [V7 captures](evidence/after/)
- [Verification and performance measurements](VALIDATION.md)
