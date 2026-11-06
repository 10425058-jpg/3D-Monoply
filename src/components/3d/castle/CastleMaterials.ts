// Color palettes & material definitions for the 3D Fantasy Central Castle
// Inspired by the 10-panel reference art (Panel 06 & Panel 08)

export const CASTLE_COLORS = {
  // Stone Architecture (Rich Warm French Ivory Limestone)
  stoneWall: '#f8edd9',        // Rich buttery ivory stone
  stoneTrim: '#ecd3b4',        // Warm beveled stone trims & voussoirs
  stoneDark: '#ceb48f',        // Plinths, basements & cornices
  stonePavement: '#f5e8d3',    // Plaza pavers
  stonePaverDark: '#decaa8',   // Paver border rings & star compass inlays
  compassStarGold: '#f59e0b',  // Inlaid star compass gold accent

  // Roofs (Vibrant Toy Miniature Saturation)
  roofRoyalBlue: '#1d4ed8',    // Dominant spires & high roofs (royal blue)
  roofRoyalDark: '#1e40af',    // Tower eaves & flared conical rims
  roofRoyalAccent: '#172554',  // Deep shading
  roofTerracotta: '#ea580c',   // Supporting buildings warm terracotta orange/red
  roofTerracottaDark: '#c2410c',
  roofTealDome: '#0d9488',     // Garden pavilion dome

  // Gold & Metals (Polished Brass & Gilt)
  goldPolished: '#f59e0b',     // Crown medallion, finials, weather vane
  goldHighlight: '#fbbf24',    // Medallion raised relief & trim
  bronzeLamp: '#1e293b',       // Lamppost cast iron/bronze
  ironHardware: '#334155',     // Door hinges & studs

  // Wood
  woodDoor: '#78350f',         // Castle heavy oak double doors
  woodPlank: '#92400e',        // Cafe furniture & dock wood
  woodBench: '#b45309',        // Park benches
  woodDark: '#451a03',         // Window mullions & structural beams

  // Heraldry & Fabrics
  bannerBlue: '#1d4ed8',       // Royal heraldic blue
  bannerPurple: '#7e22ce',     // Royal purple
  bannerRed: '#dc2626',        // Tower pennant flags
  awningRed: '#e11d48',        // Shop & cafe awnings
  awningWhite: '#ffffff',

  // Lighting & Glass
  lightWarmInterior: '#fef08a',
  lightGlowEmissive: '#f59e0b',
  windowGlass: '#bae6fd',

  // Water & Foam
  waterTurquoise: '#06b6d4',
  waterDeep: '#0284c7',
  waterSpray: '#e0f2fe',
  waterFoam: '#ffffff',

  // Vegetation (Lush Harmonious Pastels)
  sakuraLight: '#fbcfe8',      // Soft pastel pink blossoms
  sakuraMid: '#f472b6',        // Bright blossom
  sakuraDeep: '#ec4899',       // Deep rose-magenta
  sakuraTrunk: '#5c3a21',
  pineFoliage: '#15803d',      // Evergreen cypress
  pineFoliageLight: '#22c55e',
  hedgeGreen: '#4d9b2b',
  grassLush: '#5ba338',
  flowerRose: '#f43f5e',
  flowerYellow: '#facc15',
  flowerLavender: '#c084fc',
} as const;
