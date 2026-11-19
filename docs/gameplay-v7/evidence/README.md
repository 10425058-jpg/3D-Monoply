# Gameplay evidence

## Dice and motion

These are six frames from the running game in each build. Both runs use the same 3 + 5 roll. The token visits spaces 1 through 8. The post-render traces hold dice orientation, token position and committed tile for each sampled frame.

| Moment | Baseline | V7 |
| --- | --- | --- |
| Throw | ![Baseline dice mid-roll](before/01-roll.jpg) | ![V7 dice mid-roll](after/01-roll.jpg) |
| Committed faces | ![Baseline dice at rest](before/02-dice-landed.jpg) | ![V7 dice at rest](after/02-dice-landed.jpg) |
| First hop | ![Baseline token starting its route](before/03-hop.jpg) | ![V7 token starting its route](after/03-hop.jpg) |
| Crossing | ![Baseline token crossing the board](before/04-crossing.jpg) | ![V7 token crossing the board](after/04-crossing.jpg) |
| Approach | ![Baseline token nearing its destination](before/05-approach.jpg) | ![V7 token nearing its destination](after/05-approach.jpg) |
| Landing | ![Baseline token at tile eight](before/06-destination.jpg) | ![V7 token at tile eight](after/06-destination.jpg) |

[Baseline trace](before/motion-trace.json) · [V7 trace](after/motion-trace.json) · [Dice matrix](dice-matrix.json)
