# Asset inventory and budgets

All 22 GLBs passed inspection of actual buffer/accessor bytes, indexed triangles, bounds, origins, PBR materials, embedded PNG pixels and referenced UV texels. The manifest records individual SHA-256 hashes. The foundation artifact is retained unchanged as the completed milestone A checkpoint.

Hard limits: main island high 40k, balanced 25k, low 16k, distant 8k triangles; 3 MiB per GLB; 24 material primitives maximum; embedded image dimensions at most 256². Actual main islands use ten material primitives and one embedded 128² atlas each. Runtime models do not cast or receive shadows. The distant LOD uses Blender collapse decimation at 0.5 on low geometry.

| Runtime tier | Requested GLBs | Transfer MiB | Submitted asset triangles before culling | Atlas RGBA+mips KiB estimate |
| --- | ---: | ---: | ---: | ---: |
| low | 3 | 1.86 | 27,336 | 256.0 |
| balanced | 4 | 3.87 | 57,823 | 341.3 |
| high | 5 | 6.04 | 91,305 | 426.7 |

Water ribbons add 52 triangles in low and 96 in balanced/high, with 4 or 6 unshadowed draws. Existing sky, mountain and cloud passes are additional. Atlas estimates assume RGBA8 and a full mip chain; actual driver memory may differ. GLBs each embed their atlas for portability; all materials within one loaded GLB share it. No texture decoder or new library is required. Only the active quality's files preload; standalone props and the foundation checkpoint are not requested by gameplay.

| GLB | Triangles / hard budget | KiB | Material draws | Atlas+mips KiB |
| --- | ---: | ---: | ---: | ---: |
| cherry-blossom-low.glb | 316 / 12,000 | 34.6 | 2 | 85.3 |
| cherry-blossom.glb | 1,372 / 12,000 | 79.7 | 2 | 85.3 |
| fantasy-airship-balanced.glb | 1,860 / 6,000 | 122.1 | 5 | 85.3 |
| fantasy-airship-low.glb | 1,332 / 4,000 | 103.3 | 5 | 85.3 |
| fantasy-airship.glb | 2,740 / 6,000 | 160.8 | 5 | 85.3 |
| fantasy-house-low.glb | 820 / 12,000 | 84.3 | 7 | 85.3 |
| fantasy-house.glb | 1,812 / 12,000 | 157.6 | 7 | 85.3 |
| foundation-island.glb | 2,137 / 12,000 | 234.4 | 3 | 85.3 |
| garden-lantern-low.glb | 286 / 12,000 | 34.2 | 3 | 85.3 |
| garden-lantern.glb | 462 / 12,000 | 50.2 | 3 | 85.3 |
| royal-bridge-low.glb | 1,784 / 12,000 | 129.6 | 3 | 85.3 |
| royal-bridge.glb | 2,440 / 12,000 | 162.4 | 3 | 85.3 |
| royal-castle-low.glb | 5,495 / 8,000 | 354.7 | 7 | 85.3 |
| royal-castle.glb | 17,795 / 20,000 | 1148.6 | 7 | 85.3 |
| royal-island-left-balanced.glb | 24,722 / 25,000 | 1645.0 | 10 | 85.3 |
| royal-island-left-distant.glb | 6,495 / 8,000 | 544.3 | 10 | 85.3 |
| royal-island-left-low.glb | 12,990 / 16,000 | 900.8 | 10 | 85.3 |
| royal-island-left.glb | 37,766 / 40,000 | 2463.9 | 10 | 85.3 |
| royal-island-right-balanced.glb | 24,746 / 25,000 | 1647.6 | 10 | 85.3 |
| royal-island-right-distant.glb | 6,506 / 8,000 | 546.1 | 10 | 85.3 |
| royal-island-right-low.glb | 13,014 / 16,000 | 903.3 | 10 | 85.3 |
| royal-island-right.glb | 37,798 / 40,000 | 2466.9 | 10 | 85.3 |

Original procedural assets and atlas: repository MIT license. No downloaded model, generated image, paid provider or third-party asset package was used.
