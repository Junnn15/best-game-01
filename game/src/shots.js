// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (build the planned towers, upgrade what it can, start each
// wave as soon as the last one clears), so the frame is what a real game looks
// like and the same seed always gives the same frame.
import { STEP, TOWERS, WAVE_COUNT } from './config.js';
import { EVENT_WIN, EVENT_LOSE } from './world.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 55;
const END_LIMIT_SECONDS = 900;

// The autopilot's build order: strong coverage of the path's corners first.
const BUILD_PLAN = [
  [3, 'ember'], [5, 'spark'], [1, 'frost'], [6, 'ember'],
  [8, 'spark'], [2, 'frost'], [10, 'ember'], [4, 'spark'],
  [7, 'frost'], [0, 'ember'], [9, 'spark'], [11, 'frost'],
];

function autopilot(world) {
  const s = world.state;
  if (s.over) return;
  if (s.waveActive) return;
  // Spend gold: finish the build plan first, then upgrade the weakest tower.
  for (const [plot, kind] of BUILD_PLAN) {
    if (s.towers.some((t) => t.plotIndex === plot)) continue;
    if (s.gold >= TOWERS[kind].cost) {
      world.buildTower(plot, kind);
      return;
    }
    break;
  }
  let weakest = null;
  for (let i = 0; i < s.towers.length; i += 1) {
    if (s.towers[i].level < 3 && (!weakest || s.towers[i].level < s.towers[weakest].level)) weakest = i;
  }
  if (weakest !== null) {
    const tower = s.towers[weakest];
    const cost = Math.round(TOWERS[tower.kind].cost * (0.7 + 0.35 * tower.level));
    if (s.gold >= cost) {
      world.upgradeTower(weakest);
      return;
    }
  }
  if (s.wave < WAVE_COUNT) world.startWave();
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    // Title backdrop: a few towers already standing, the heart glowing.
    world.buildTower(3, 'ember');
    world.buildTower(5, 'spark');
    world.buildTower(1, 'frost');
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let events = 0;
  for (let i = 0; i < limit / STEP; i += 1) {
    autopilot(world);
    events |= world.step(STEP);
    if (events & (EVENT_WIN | EVENT_LOSE)) break;
  }
  if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
  if (events & EVENT_LOSE) return { screen: SCREEN_LOSE, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
