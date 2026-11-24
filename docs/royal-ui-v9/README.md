# V9 Royal UI & Popup Unification

The Solo and Online interfaces now share a royal dialog frame, controls, fields, notices and motion. The popup components use the existing match, auction, trade, railroad, progression and server handlers. The title deed and Property Evolution use side panels so the board remains available during property inspection. Bank Heist and Shutdown settle on selection and display timed result notices.

- [Baseline inventory and interaction audit](AUDIT.md)
- [Design tokens, components and artwork provenance](DESIGN.md)
- [Test results, timings and changed files](VERIFICATION.md)

## Before and after

The desktop comparison uses 1440 × 900. Screenshots come from the running game. The Solo cases use repeatable loopback fixtures and the Online cases use two test accounts on a disposable local database.

| Surface | Before | After |
| --- | --- | --- |
| Auction | [Before](evidence/before/auction.jpg) | [After](evidence/after/auction.jpg) |
| Trade | [Before](evidence/before/trade.jpg) | [After](evidence/after/trade.jpg) |
| Railroad bonus and Shutdown | [Before](evidence/before/railroad.jpg) | [Selection](evidence/after/railroad.jpg) · [Result](evidence/after/shutdown-result.jpg) |
| Bank Heist | [Before](evidence/before/bank-heist.jpg) | [Vault selection](evidence/after/bank-heist.jpg) · [Reward](evidence/after/heist-reward.jpg) |
| Chance and Community Chest | [Chance before](evidence/before/chance.jpg) | [Chance](evidence/after/chance.jpg) · [Community Chest](evidence/after/community-chest.jpg) · [AI draw](evidence/after/ai-card.jpg) |
| Property Evolution | [Before](evidence/before/evolution.jpg) | [Evolution](evidence/after/evolution.jpg) · [Deed](evidence/after/property-deed.jpg) · [Insufficient funds](evidence/after/insufficient-funds.jpg) |
| Journey | [Before](evidence/before/journey.jpg) | [Daily](evidence/after/journey.jpg) · [Lucky Spin](evidence/after/lucky-spin.jpg) · [Missions](evidence/after/mission-claimed.jpg) · [Album](evidence/after/album.jpg) · [Pack opened](evidence/after/pack-reveal.jpg) |
| Settings | [Before](evidence/before/settings.jpg) | [After](evidence/after/settings.jpg) |
| Menu settings | [Before](evidence/before/menu-settings.jpg) | [After](evidence/after/menu-settings.jpg) |
| Statistics and Rules | [Statistics before](evidence/before/statistics.jpg) · [Rules before](evidence/before/rules.jpg) | [Statistics](evidence/after/statistics.jpg) · [Rules](evidence/after/rules.jpg) |
| Jail and debt | [Jail before](evidence/before/jail.jpg) · [Debt before](evidence/before/debt.jpg) | [Jail](evidence/after/jail.jpg) · [Debt](evidence/after/debt.jpg) |
| Victory and bankruptcy | [Victory before](evidence/before/victory.jpg) | [Victory](evidence/after/victory.jpg) · [Bankruptcy](evidence/after/bankruptcy.jpg) |
| Online dialogs and notices | — | [Profile](evidence/after/online-profile.jpg) · [Create room](evidence/after/online-create-room.jpg) · [Pending join](evidence/after/online-join-pending.jpg) · [Join error](evidence/after/online-join-error.jpg) · [Reconnect](evidence/after/online-reconnect.jpg) · [Forfeit](evidence/after/online-forfeit.jpg) · [Standings](evidence/after/online-results.jpg) |

## Responsive evidence

| Viewport | Auction capture |
| --- | --- |
| 1920 × 1080 | [1920 × 1080](evidence/after/auction-1920x1080.jpg) |
| 1600 × 900 | [1600 × 900](evidence/after/auction-1600x900.jpg) |
| 1440 × 900 | [1440 × 900](evidence/after/auction-1440x900.jpg) |
| 1366 × 768 | [1366 × 768](evidence/after/auction-1366x768.jpg) |
| 1024 × 768 | [1024 × 768](evidence/after/auction-1024x768.jpg) |
| 390 × 844 | [390 × 844](evidence/after/auction-390x844.jpg) |

The phone captures include [Chance before](evidence/before/chance-mobile.jpg) and [Chance after](evidence/after/chance-mobile.jpg), [trade fields](evidence/after/trade-mobile.jpg), [trade summary](evidence/after/trade-mobile-summary.jpg) and [Property Evolution](evidence/after/evolution-mobile.jpg). [Layout measurements](evidence/responsive.json) record the viewport, frame bounds, scroll area, focus and footer reachability.
