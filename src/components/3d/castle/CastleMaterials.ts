// Color palettes & material definitions for the 3D Fantasy Central Castle
// Phase 1: warm limestone, glazed slate and restrained brushed brass.

export const CASTLE_COLORS = {
  // Stone Architecture (Rich Warm French Ivory Limestone)
  stoneWall: '#e9dfca',        // Ivory limestone retains highlights under sunlight
  stoneTrim: '#d6c4a5',        // Warm beveled stone trims & voussoirs
  stoneDark: '#aa9476',        // Plinths, basements & cornices
  stoneQuoin: '#f0dfc8',       // Corner rusticated ashlar stones
  stonePavement: '#c9c3b3',    // Neutral warm stone separates paths from the walls
  stonePaverDark: '#decaa8',   // Paver border rings & star compass inlays
  stonePaverAccent: '#bfa382', // Darker contrasting border pavers
  compassStarGold: '#c7a15e',  // Inlaid star compass gold accent
  carpetRoyalBlue: '#1e3a8a',  // Ceremonial staircase carpet runner
  carpetTrimGold: '#fbbf24',   // Staircase carpet gold border trim

  // Royal blue glazed slate with readable overlap tones
  roofRoyalBlue: '#315695',    // Dominant spires & high roofs (royal blue)
  roofRoyalDark: '#243d6e',    // Tower eaves & flared conical rims
  roofRoyalTileLight: '#5478ad', // Stepped tile highlight rings
  roofRoyalTileDark: '#1e3a8a',  // Shadow tile underside rings
  roofRoyalAccent: '#172554',  // Deep shading
  roofTerracotta: '#a75c48',   // Fired terracotta on supporting buildings
  roofTerracottaDark: '#784539',
  roofTerracottaTile: '#bd7b5d', // Shingle edge highlight
  roofTealDome: '#0d9488',     // Garden pavilion dome

  // Gold & Metals (Polished Brass & Gilt)
  goldPolished: '#c7a15e',     // Crown medallion, finials, weather vane
  goldHighlight: '#dfc27e',    // Medallion raised relief & trim
  goldFiligree: '#94703f',     // Deep relief gold filigree shadow
  bronzeLamp: '#1e293b',       // Lamppost cast iron/bronze
  ironHardware: '#334155',     // Door hinges & studs

  // Gems & Jewels
  gemRuby: '#ef4444',
  gemSapphire: '#3b82f6',
  gemEmerald: '#10b981',

  // Wood
  woodDoor: '#78350f',         // Castle heavy oak double doors
  woodPlank: '#92400e',        // Cafe furniture & dock wood
  woodBench: '#b45309',        // Park benches
  woodDark: '#451a03',         // Window mullions & structural beams

  // Heraldry & Fabrics
  bannerBlue: '#315695',       // Royal heraldic blue
  bannerPurple: '#7e22ce',     // Royal purple
  bannerRed: '#dc2626',        // Tower pennant flags
  awningRed: '#e11d48',        // Shop & cafe awnings
  awningWhite: '#ffffff',

  // Lighting & Glass
  lightWarmInterior: '#efcb87',
  lightGlowEmissive: '#c98c45',
  windowGlass: '#bae6fd',

  // Water & Foam
  waterTurquoise: '#398f9c',
  waterDeep: '#226777',
  waterSpray: '#e0f2fe',
  waterFoam: '#ffffff',

  // Vegetation (Lush Harmonious Pastels)
  sakuraLight: '#fbcfe8',      // Soft pastel pink blossoms
  sakuraMid: '#dfa0b7',        // Rose blossom
  sakuraDeep: '#bc728f',       // Deep rose-magenta
  sakuraTrunk: '#5c3a21',
  pineFoliage: '#15803d',      // Evergreen cypress
  pineFoliageLight: '#619766',
  hedgeGreen: '#4f7e43',
  grassLush: '#648953',
  flowerRose: '#f43f5e',
  flowerYellow: '#facc15',
  flowerLavender: '#c084fc',
} as const;
