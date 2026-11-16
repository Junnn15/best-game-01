// EMBERFALL — a tower defense. The Emberheart crystal must survive 10 waves of
// Gloomlings. All tuning lives here: the field, the path, the build plots, the
// three tower kinds, the five enemy kinds and the ten waves.

export const STEP = 1 / 60;
export const FIELD = { width: 960, height: 600 };
export const BEST_KEY = 'emberfall-best';
export const START_GOLD = 130;
export const START_LIVES = 20;
export const WAVE_COUNT = 10;

// The path the Gloomlings walk, left gate to the Emberheart. The heart sits on
// the last waypoint.
export const PATH = [
  { x: -20, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 290 },
  { x: 160, y: 290 },
  { x: 160, y: 480 },
  { x: 880, y: 480 },
];
export const HEART = { x: 900, y: 480, radius: 30 };

// Build plots: circles a tower can stand on. None of them sits on the path.
export const PLOTS = [
  { x: 120, y: 190 }, { x: 300, y: 190 }, { x: 480, y: 190 }, { x: 660, y: 190 },
  { x: 880, y: 190 }, { x: 700, y: 390 }, { x: 520, y: 390 }, { x: 340, y: 390 },
  { x: 60, y: 390 }, { x: 880, y: 390 }, { x: 300, y: 540 }, { x: 520, y: 540 },
];
export const PLOT_RADIUS = 26;

// Tower kinds. damage/range/rate grow per level; slow and chain are the
// Frost and Spark signatures.
export const TOWERS = {
  ember: {
    name: 'Ember', key: '1', cost: 50, color: '#ff7a2f', dark: '#c24e0e',
    range: 115, damage: 14, rate: 1.1, splash: 46,
    desc: 'Fireball. Splash damage.',
    levels: [
      { damage: 14, range: 115, rate: 1.1 },
      { damage: 24, range: 125, rate: 1.2 },
      { damage: 40, range: 140, rate: 1.35 },
    ],
  },
  frost: {
    name: 'Frost', key: '2', cost: 40, color: '#59c8f5', dark: '#1d7fb8',
    range: 105, damage: 5, rate: 1.6, slow: 0.45, slowTime: 1.3,
    desc: 'Chill. Slows enemies.',
    levels: [
      { damage: 5, range: 105, rate: 1.6 },
      { damage: 9, range: 115, rate: 1.7 },
      { damage: 15, range: 128, rate: 1.9 },
    ],
  },
  spark: {
    name: 'Spark', key: '3', cost: 60, color: '#ffd94a', dark: '#c79a12',
    range: 125, damage: 8, rate: 2.3, chain: 2,
    desc: 'Lightning. Chains to foes.',
    levels: [
      { damage: 8, range: 125, rate: 2.3 },
      { damage: 13, range: 135, rate: 2.5 },
      { damage: 21, range: 148, rate: 2.8 },
    ],
  },
};
export const TOWER_KINDS = ['ember', 'frost', 'spark'];
export const MAX_LEVEL = 3;
export const SELL_RATE = 0.7;

// Enemy kinds. hp scales with the wave (see waves.js table below).
export const ENEMIES = {
  grub: { name: 'Grub', hp: 30, speed: 55, gold: 6, leak: 1, radius: 13, color: '#8a5cf6', dark: '#5b32b8' },
  swift: { name: 'Swift', hp: 20, speed: 96, gold: 7, leak: 1, radius: 10, color: '#f5539e', dark: '#b01e66' },
  bulwark: { name: 'Bulwark', hp: 130, speed: 36, gold: 12, leak: 2, radius: 17, color: '#6b7a8d', dark: '#42506a' },
  wisp: { name: 'Wisp', hp: 48, speed: 72, gold: 9, leak: 1, radius: 11, color: '#7fe0a8', dark: '#3d9e63' },
  dreadmaw: { name: 'Dreadmaw', hp: 1500, speed: 30, gold: 200, leak: 10, radius: 26, color: '#ff3b3b', dark: '#8f0f0f' },
};

// Waves: each entry is [kind, count, gapSeconds] groups, spawned in order.
// hpMul grows so later waves need upgraded towers.
export const WAVES = [
  { hpMul: 1.0, groups: [['grub', 8, 0.9]] },
  { hpMul: 1.15, groups: [['grub', 10, 0.8], ['swift', 4, 0.7]] },
  { hpMul: 1.35, groups: [['grub', 10, 0.7], ['swift', 8, 0.6], ['wisp', 3, 0.8]] },
  { hpMul: 1.6, groups: [['swift', 10, 0.55], ['bulwark', 4, 1.2], ['grub', 8, 0.6]] },
  { hpMul: 1.9, groups: [['wisp', 10, 0.6], ['bulwark', 6, 1.0], ['swift', 10, 0.5]] },
  { hpMul: 2.25, groups: [['bulwark', 8, 0.9], ['grub', 14, 0.5], ['wisp', 8, 0.55]] },
  { hpMul: 2.5, groups: [['swift', 16, 0.45], ['bulwark', 8, 0.85], ['wisp', 10, 0.5]] },
  { hpMul: 2.9, groups: [['bulwark', 12, 0.8], ['wisp', 14, 0.45], ['swift', 14, 0.4]] },
  { hpMul: 3.3, groups: [['grub', 18, 0.4], ['bulwark', 12, 0.75], ['wisp', 14, 0.4], ['swift', 16, 0.35]] },
  { hpMul: 3.8, groups: [['dreadmaw', 1, 1.0], ['bulwark', 8, 0.9], ['wisp', 10, 0.5], ['swift', 12, 0.4]] },
];

export function waveBonus(wave) {
  return 30 + 5 * wave;
}

export function upgradeCost(kind, level) {
  // Cost to go from `level` to `level + 1` (level is 1-based, max 3).
  return Math.round(TOWERS[kind].cost * (0.7 + 0.35 * level));
}
