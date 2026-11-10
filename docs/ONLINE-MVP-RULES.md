# 3D Monopoly — Online MVP Rules v1.0.0

**Status:** Normative proposed online rules (requires backend implementation/tests). **Not** a description of current local AI behavior.
**Ruleset:** `mini-v1` | **Map:** `central-castle` | **Content:** `central-castle@1`
**Reason for name:** This is a deliberately simplified, finite variant for the 21-day online MVP, **not** full classic Monopoly. Full auction, building, mortgages, negotiation and trading remain possible in a future `classic-v1` ruleset. Do not present `mini-v1` as classic.

## 1. Board, players, economy, winner

- Server owns versioned content copied/validated from `src/data/boardData.ts` and `src/data/cardsData.ts`: unique space IDs 0–39, one `GO` at 0, `Jail` at 10, `Free Parking` at 20, `Go To Jail` at 30, Chance/Community Chest and taxes at their catalog positions. Version change requires content-version bump and synchronized frontend board data. Server validates catalog on startup.
- 2–4 **human** players, initial cash 1500, location 0, no owned property, no houses/hotels/mortgages, and no jail cards. All money is an integer in [0, 2147483647], both in API and DB (PostgreSQL INTEGER). Bank has unlimited funds.
- Board position increases clockwise modulo 40. When a forward move passes or lands on GO award **200 once**; no award for backwards moves, direct Go To Jail, or jail relocation. A card moving to GO awards 200.
- All legal ownership, dice, cards, cash and outcomes are computed server-side; the client animates committed events. Cards and dice use secure server randomness. Bank board/currency data cannot be submitted by clients.
- Every **completed player turn** advances `completedTurns`; doubles extra rolls stay within one turn and do not advance it. When one non-bankrupt player remains, finish immediately. After **80 completed player turns**, finish deterministically using net worth = cash + sum of printed purchase prices of owned unmortgaged properties. Tie breakers: higher cash, then larger number of properties, then smaller initial `seatOrder`. Persist `winnerPlayerId`, `finishReason` and emit `game:finished`.
- A player may voluntarily `forfeit` from an active or paused match. It counts as bankruptcy to the Bank, so their deeds become unowned. Disconnect timeout forfeits are specified in [API-CONTRACT.md](./API-CONTRACT.md). If every player becomes absent before a winner can be chosen, the match is `ABANDONED` with no winner.

## 2. Allowed game phases and actions

`turnPhase` is a **committed decision phase**: `PRE_ROLL`, `LANDED_ACTION` (unowned purchasable property), `END_TURN`, or `GAME_OVER`. `ROLLING`, `MOVING`, `CARD_DRAWN` are presentation events rather than persistently blocking phases in mini-v1. `DEBT_RESOLUTION` and `AUCTION` are not reachable in mini-v1. Pausing is `MatchState.status=PAUSED`, not a turn phase.

| Current situation | Valid REST action | Outcome |
|---|---|---|
| Normal active player's `PRE_ROLL` | `roll-dice` | Server commits all dice, movement, landing, rent/card/tax and phase results atomically |
| `PRE_ROLL` and player in Jail | `roll-dice`, `pay-jail-bail` or `use-jail-card` (if held) | See Jail rules below |
| `LANDED_ACTION` on unowned affordable purchasable property | `buy-property` or `decline-property` | Buy transfers printed price to Bank; decline leaves it unowned. **No auction** in mini-v1 |
| `END_TURN` | `end-turn` | Advance to next solvent player and reset roll modifiers |
| Any active/paused participant | `forfeit` | Remove from active turn order; update winner if required |

If purchase is unaffordable, server automatically declines the space and proceeds; there is no unaffordable purchase prompt. On a double, resolve all landing consequences first; if player is still solvent, `pendingExtraRoll=true` leads to `PRE_ROLL` rather than `END_TURN`. Buying/declining on a double also transitions to `PRE_ROLL`. `end-turn` while extra roll is pending is invalid. A non-double resets `doublesCount`. The **third consecutive doubles** sends player directly to Jail: no movement on third roll, no GO bonus, no extra roll.

## 3. Landing resolution — every board space type

| Space type | Server action |
|---|---|
| GO | Salary if reached by qualifying forward movement (once) |
| Unowned property/railroad/utility | Enter `LANDED_ACTION` if affordable; otherwise auto-decline |
| Own property | No rent |
| Other player's unmortgaged property | Calculate rent from server catalog; charge or bankrupt payer |
| Chance / Community Chest | Draw next available card from corresponding server deck and apply **all** effects atomically |
| Tax | Pay printed `taxAmount` to Bank; insufficient cash triggers bankruptcy |
| Jail / Just Visiting | No penalty on ordinary landing |
| Free Parking | No money or action |
| Go To Jail | Move to space 10, set `inJail=true`, clear extra roll and doubles, do **not** collect GO |

Rent in mini-v1: street base rent from first entry of `rent[]`, doubled if owner controls full color set (no houses in mini-v1); railroad rent uses 1/2/3/4-owned scale from server catalog; utility rent is 4× last dice total if owner has one utility, 10× if both. No rent on own property or mortgaged property (no newly mortgaged deeds exist in mini-v1). All computed amounts must be within the money range.

## 4. Chance and Community Chest

The server must implement **all action types actually present** in `src/types/game.ts` and `src/data/cardsData.ts` before online MVP is marked playable:

| Card action type | Required server behavior |
|---|---|
| `collect` | Credit amount from Bank |
| `pay` | Pay Bank or declare bankruptcy |
| `move_to` | Move to target, apply GO salary on qualifying forward crossing, then resolve destination once |
| `move_relative` | Move signed steps; backwards does not earn GO, resolve destination |
| `nearest_utility` | Move forward to next utility; resolve its ownership/rent (if owned, card-specific rent only when explicitly encoded) |
| `nearest_railroad` | Move forward to next railroad; resolve its ownership/rent |
| `go_to_jail` | Direct Jail, no GO salary |
| `get_out_of_jail` | Add specific card ID to player's hand; remove from available deck until used/returned |
| `repairs` | Charge `perHouse * houses + perHotel * hotels` (0 for new mini-v1 games) |
| `pay_each_player` | In ascending `seatOrder`, transfer amount to each remaining solvent player; if payer cannot pay next recipient, bankrupt to that recipient and stop |
| `collect_from_each_player` | In ascending `seatOrder`, each solvent other player pays drawer; if a payer cannot pay, bankrupt that payer to drawer and continue with remaining players |

Shuffle and store deck order/cursor on server when match starts; persist state and held Jail cards. Returning Jail card places it at the bottom of its corresponding deck. Persist last card resolved and resulting events for reconnect; do **not** expose future card order in public snapshots. Chained card movement resolving a destination is finite; guard against excessive recursion and fail the atomic transaction rather than partial money changes.

## 5. Jail and doubles

- Enter Jail on square 30, Jail card, or third consecutive double. Relocate to 10 and set `inJail=true`, `jailTurns=0`; no GO salary and no additional roll.
- At start of jail turn: player may `pay-jail-bail` for 50 (if affordable) or `use-jail-card` (if held). Either releases immediately into `PRE_ROLL`, then they roll normally.
- Otherwise `roll-dice` is a Jail attempt. On doubles, release and move by total; **no extra roll** for successful Jail doubles. On a failed attempt increment `jailTurns`: after attempts 1 or 2 remain in Jail and end turn; after failed attempt 3 automatically pay 50 and move by that final roll, or become bankrupt to Bank if unable to pay.
- A player in Jail still owns properties and collects rent. Card IDs for held Get Out of Jail Free are persisted and removed from draw deck until returned.

## 6. No negative money, insolvency, bankruptcy

- Before debiting, verify cash. A solvent player cannot have negative balance: `match_players.money INTEGER NOT NULL CHECK(money >= 0)`.
- **Mini-v1 does not support mortgages, building sales, loans or manual debt resolution.** If an obligation (rent, card, tax, forced Jail bail) exceeds available cash, declare bankruptcy immediately in the same transaction. For a creditor player: transfer the bankrupt player's **remaining cash** and property deeds to that creditor; any unpaid remainder is written off. For the Bank: deeds become unowned and remaining cash returns to Bank. No negative balance, no stuck `DEBT_RESOLUTION` phase.
- Skip bankrupt players for turns, bidding, per-player card effects; forfeit to Bank uses the same liquidation policy. If the active player bankrupts, automatically select the next solvent player; if one remains emit finish.
- There are no auctions/trades/builds or mortgage actions in mini-v1. Do not expose controls for them in online mode. The local/AI mode may retain its richer legacy rules unchanged.

## 7. Required server tests before calling online MVP playable

GO forward/backwards, card movement to GO, third doubles, first/second/third Jail rolls, Jail card use, tax, both deck types and **every listed card action**, all board types, rent per property/railroad/utility, unaffordable buy auto-decline, debit at zero and over balance, bankruptcy-to-player/bank, winner after bankruptcy, winner at 80 turns/ties, double extra-roll after landing action, resumption after disconnect. These must use exact versioned `central-castle@1` content, not invented card/price data.
