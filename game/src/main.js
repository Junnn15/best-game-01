// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one, times the speed
// multiplier), and the renderer paints what is there. The game moves between
// five screens: title, play, paused, victory and defeat.
//
// ?seed=N fixes the wave pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, PLOT_RADIUS, PLOTS, STEP, TOWERS, TOWER_KINDS } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  ACTION_CANCEL, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_SPEED,
  ACTION_START, createInput,
} from './input.js';
import { EVENT_CLEAR, EVENT_KILL, EVENT_LEAK, EVENT_LOSE, EVENT_WIN, UI, createWorld } from './world.js';
import {
  SCREEN_LOSE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const state = world.state;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function inRect(p, r) {
  return p && r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best, { x: -999, y: -999, inside: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // Hit regions from the last paint, for click handling.
  let lastBuildMenu = null;
  let lastTowerPanel = null;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the Emberheart.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_LOSE;
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.lose();
    announce(won ? `Victory! Score ${state.score}.` : `Defeat on wave ${state.wave}. Score ${state.score}.`);
  }

  function handleClick(click) {
    if (!click) return;
    audio.unlock();
    if (screen === SCREEN_TITLE) {
      audio.click();
      startGame();
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      audio.click();
      startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    // Play screen: HUD buttons first.
    if (inRect(click, UI.muteButton)) {
      state.muted = audio.toggleMute();
      return;
    }
    if (inRect(click, UI.speedButton)) {
      state.speed = state.speed === 2 ? 1 : 2;
      audio.click();
      return;
    }
    if (inRect(click, UI.startButton)) {
      if (world.startWave()) {
        audio.horn();
        announce(`Wave ${state.wave} incoming.`);
      }
      return;
    }
    // Tower panel buttons.
    if (lastTowerPanel) {
      if (inRect(click, lastTowerPanel.upRect)) {
        if (world.upgradeTower(state.selectedTower)) audio.upgrade();
        else audio.denied();
        return;
      }
      if (inRect(click, lastTowerPanel.sellRect)) {
        const refund = world.sellTower(state.selectedTower);
        if (refund > 0) audio.sell();
        return;
      }
    }
    // Build menu cards.
    if (lastBuildMenu) {
      for (const card of lastBuildMenu.cards) {
        if (inRect(click, card.rect)) {
          if (world.buildTower(state.selectedPlot, card.kind)) audio.build();
          else audio.denied();
          return;
        }
      }
      // Clicking elsewhere with the menu open closes it (unless it hit a plot).
      if (!inRect(click, lastBuildMenu) && world.plotAt(click.x, click.y) < 0) {
        state.selectedPlot = -1;
        state.selectedTower = -1;
        state.buildKind = null;
        return;
      }
    }
    // Plots and towers.
    const plot = world.plotAt(click.x, click.y);
    if (plot >= 0) {
      const towerIndex = world.towerAtPlot(plot);
      if (towerIndex >= 0) {
        state.selectedTower = towerIndex;
        state.selectedPlot = -1;
        state.buildKind = null;
        audio.click();
      } else {
        state.selectedPlot = plot;
        state.selectedTower = -1;
        state.buildKind = TOWER_KINDS[0];
        audio.click();
      }
      return;
    }
    state.selectedPlot = -1;
    state.selectedTower = -1;
    state.buildKind = null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const picked = input.takePickedKind();
    if (picked && screen === SCREEN_PLAY && state.selectedPlot >= 0) {
      state.buildKind = picked;
      if (world.buildTower(state.selectedPlot, picked)) audio.build();
      else audio.denied();
    }
    if (actions & ACTION_MUTE) {
      state.muted = audio.toggleMute();
    }
    if (actions & ACTION_SPEED && screen === SCREEN_PLAY) {
      state.speed = state.speed === 2 ? 1 : 2;
    }
    if (actions & ACTION_CANCEL) {
      state.selectedPlot = -1;
      state.selectedTower = -1;
      state.buildKind = null;
      if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_START) {
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_LOSE) {
        startGame();
      } else if (screen === SCREEN_PLAY && world.startWave()) {
        audio.horn();
        announce(`Wave ${state.wave} incoming.`);
      }
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_WIN || screen === SCREEN_LOSE || screen === SCREEN_PLAY)) {
      startGame();
    }
  }

  function step() {
    const events = world.step(STEP);
    if (events & EVENT_KILL) audio.pop();
    if (events & EVENT_LEAK) audio.leak();
    if (events & EVENT_CLEAR) {
      audio.waveClear();
      announce(`Wave ${state.wave} clear.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_LOSE) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick(input.takeClick());
    // Hover a build card to preview that tower's range.
    if (lastBuildMenu && state.selectedPlot >= 0) {
      const p = input.pointer;
      let hovered = null;
      for (const card of lastBuildMenu.cards) {
        if (inRect(p, card.rect)) hovered = card.kind;
      }
      if (hovered) state.buildKind = hovered;
    }
    if (screen === SCREEN_PLAY) {
      const speed = state.speed;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        for (let i = 0; i < speed; i += 1) {
          step();
          if (screen !== SCREEN_PLAY) break;
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // The title screen idles the world behind it.
      if (screen === SCREEN_TITLE) world.step(STEP);
    }
    const regions = renderer.draw(state, screen, best, input.pointer);
    lastBuildMenu = regions.buildMenu;
    lastTowerPanel = regions.towerPanel;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  // Debug handle for automated play-tests (read-only view of the game state).
  window.__emberfall = {
    get state() { return state; },
    get screen() { return screen; },
  };
  announce('Emberfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
