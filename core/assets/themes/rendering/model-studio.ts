/** Original Model Studio presentation recipe. Linear light intensities; meters; Y up.
 * Artwork/presentation only: never a CAD document or modeling command. */
export const modelStudioEnvironment = {
  id: 'model-studio', name: 'Model Studio',
  background: '#101112', toneMapping: 'aces-filmic', exposure: 1.15,
  camera: { fieldOfViewDegrees: 36 },
  fog: { nearMeters: 14, farMeters: 32 },
  ambient: { sky: '#e3ebf0', ground: '#272622', intensity: 1.2 },
  key: { color: '#fff4df', intensity: 5, direction: [-3, 8, 4] },
  fill: { color: '#ffffff', intensity: 0, direction: [-5, 2, -4] },
  rim: { color: '#b9d9ec', intensity: 3, direction: [4, 5, -5] },
  reflections: { source: 'room', intensity: 1, blur: .04 },
  shadow: { opacity: .4, mapSize: 2048, bias: -.0003 },
  grid: { minor: '#303436', major: '#555954', x: '#603d39', y: '#3a5341', z: '#3a5341', spacingMeters: 1, extentMeters: 40 },
  surface: { color: '#c6c9c7', metalness: .62, roughness: .29 },
  detailSurfaces: {
    dark: { color: '#151b1d', metalness: .72, roughness: .25 },
    metal: { color: '#939fa0', metalness: .88, roughness: .22 },
    glass: { color: '#061015', metalness: .5, roughness: .12, clearcoat: 1 },
  },
} as const;
export const modelStudioSurfaces = [
  { id: 'model-studio-porcelain', name: 'Porcelain', color: '#c6c9c7' },
  { id: 'model-studio-graphite', name: 'Graphite', color: '#50585d' },
  { id: 'model-studio-titanium', name: 'Titanium', color: '#a9bec7' },
  { id: 'model-studio-champagne', name: 'Champagne', color: '#c99c55' },
  { id: 'model-studio-sage', name: 'Sage', color: '#98b4a2' },
  { id: 'model-studio-copper', name: 'Copper', color: '#b06349' },
].map(preset => ({ ...preset, roughness: modelStudioEnvironment.surface.roughness, metalness: modelStudioEnvironment.surface.metalness }));
