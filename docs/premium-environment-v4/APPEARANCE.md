# Near-environment screenshot statistics

The fixed `hero-left-detail` crop [320, 180, 720, 440] was
selected after inspecting the actual baseline/checkpoint images. It contains
near castle island: blue roofs, ivory walls, blossoms, grass, stone and cliff edge, excluding HUD, with small sky/background gaps between silhouettes.
Both final captures use identical camera, target,
viewport and DPR. [Exact output](evidence/appearance.json).

| Descriptive statistic | Before | After |
| --- | ---: | ---: |
| Mean HSV saturation | 32.2% | 45.2% |
| Median HSV saturation | 22.8% | 35.4% |
| Display-RGB luminance standard deviation | 18.5% | 21.4% |
| Pale low-saturation pixel fraction | 26.7% | 14.2% |
| Green-class mean saturation | 53.1% | 73.3% |
| Blue-class mean saturation | 59% | 68.1% |

The tool reads actual screenshot PNG bytes using the existing repository
decoder. HSV values describe display-encoded colours; luminance statistics use
weighted display-RGB channels, not physical scene radiance. The pale fraction
uses luminance >0.63 and saturation <0.16. Green and blue classes use fixed hue
ranges and saturation >0.16; changes in geometry/palette affect their pixel
membership. This is a numerical description of the selected crop, not an
automatic visual-quality pass threshold or an attribution of every change to
fog alone. Actual image inspection is the visual authority.

Reproduce after reviewing the same crop:

```sh
python tools/compare_environment_capture.py docs/premium-environment-v4/evidence/before/hero-left-detail.png docs/premium-environment-v4/evidence/after/hero-left-detail.png --rect 320 180 720 440 --description "near castle island: blue roofs, ivory walls, blossoms, grass, stone and cliff edge, excluding HUD" --output docs/premium-environment-v4/evidence/appearance.json
```
