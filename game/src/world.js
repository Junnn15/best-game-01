// EMBERFALL's world: the state and the rules. Towers stand on plots and shoot
// Gloomlings that walk the path; leaks hurt the Emberheart; gold buys towers
// and upgrades; surviving all 10 waves wins.
import {
  ENEMIES, FIELD, HEART, MAX_LEVEL, PATH, PLOT_RADIUS, PLOTS, SELL_RATE,
  START_GOLD, START_LIVES, TOWERS, WAVE_COUNT, WAVES, upgradeCost, waveBonus,
} from './config.js';

export const EVENT_LEAK = 1 << 0;
export const EVENT_CLEAR = 1 << 1;
export const EVENT_WIN = 1 << 2;
export const EVENT_LOSE = 1 << 3;
export const EVENT_KILL = 1 << 4;

// Path geometry, computed once: segment lengths and the total length.
const SEGMENTS = [];
let PATH_LENGTH = 0;
for (let i = 0; i < PATH.length - 1; i += 1) {
  const a = PATH[i];
  const b = PATH[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEGMENTS.push({ a, b, len, start: PATH_LENGTH });
  PATH_LENGTH += len;
}

export function positionAt(dist) {
  const d = Math.max(0, Math.min(PATH_LENGTH, dist));
  for (const seg of SEGMENTS) {
    if (d <= seg.start + seg.len || seg === SEGMENTS[SEGMENTS.length - 1]) {
      const t = seg.len === 0 ? 0 : (d - seg.start) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
        angle: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x),
      };
    }
  }
  const last = PATH[PATH.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

export function createWorld(random) {
  const state = {
    gold: START_GOLD,
    lives: START_LIVES,
    wave: 0,
    score: 0,
    kills: 0,
    speed: 1,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    over: false,
    won: false,
    // UI selection, kept in the world so render and input share it.
    selectedPlot: -1,
    selectedTower: -1,
    buildKind: null,
    muted: false,
    time: 0,
  };

  function plotAt(x, y) {
    for (let i = 0; i < PLOTS.length; i += 1) {
      if (Math.hypot(PLOTS[i].x - x, PLOTS[i].y - y) <= PLOT_RADIUS + 6) return i;
    }
    return -1;
  }

  function towerAtPlot(plotIndex) {
    return state.towers.findIndex((t) => t.plotIndex === plotIndex);
  }

  function towerStats(tower) {
    return TOWERS[tower.kind].levels[tower.level - 1];
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * Math.PI * 2;
      const v = speed * (0.4 + random.next() * 0.8);
      state.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.45 + random.next() * 0.3, maxLife: 0.75,
        color, size: 2 + random.next() * 3,
      });
    }
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 0.9, maxLife: 0.9, color });
  }

  function startWave() {
    if (state.waveActive || state.over || state.wave >= WAVE_COUNT) return false;
    const wave = WAVES[state.wave];
    state.wave += 1;
    state.spawnQueue = [];
    for (const [kind, count, gap] of wave.groups) {
      for (let i = 0; i < count; i += 1) state.spawnQueue.push({ kind, gap });
    }
    state.spawnTimer = 0.5;
    state.waveActive = true;
    state.selectedPlot = -1;
    state.selectedTower = -1;
    return true;
  }

  function spawnEnemy(kind, hpMul) {
    const def = ENEMIES[kind];
    const hp = Math.round(def.hp * hpMul);
    state.enemies.push({
      kind, hp, maxHp: hp, speed: def.speed, gold: def.gold, leak: def.leak,
      radius: def.radius, color: def.color, dark: def.dark,
      dist: 0, x: PATH[0].x, y: PATH[0].y, angle: 0,
      slowUntil: 0, slowFactor: 1, wobble: random.next() * Math.PI * 2,
    });
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      state.gold += enemy.gold;
      state.kills += 1;
      state.score += enemy.gold * 10 + state.wave * 5;
      addParticles(enemy.x, enemy.y, enemy.color, 14, 120);
      addParticles(enemy.x, enemy.y, '#ffffff', 5, 60);
      addFloater(enemy.x, enemy.y - 14, `+${enemy.gold}g`, '#ffd94a');
      return true;
    }
    return false;
  }

  function applySplash(center, damage, radius, primary) {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy === primary) continue;
      if (Math.hypot(enemy.x - center.x, enemy.y - center.y) <= radius) {
        damageEnemy(enemy, damage * 0.6);
      }
    }
  }

  function applyChain(from, damage, hops) {
    let current = from;
    let remaining = hops;
    const hitSet = new Set([from]);
    while (remaining > 0) {
      let next = null;
      let bestDist = 90;
      for (const enemy of state.enemies) {
        if (enemy.dead || hitSet.has(enemy)) continue;
        const d = Math.hypot(enemy.x - current.x, enemy.y - current.y);
        if (d < bestDist) {
          bestDist = d;
          next = enemy;
        }
      }
      if (!next) break;
      hitSet.add(next);
      state.particles.push({
        x: current.x, y: current.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15,
        color: '#ffe98a', size: 3, boltTo: next,
      });
      damageEnemy(next, damage * 0.7);
      current = next;
      remaining -= 1;
    }
  }

  function fireTower(tower) {
    const stats = towerStats(tower);
    const plot = PLOTS[tower.plotIndex];
    // Target the enemy furthest along the path that is in range.
    let target = null;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const d = Math.hypot(enemy.x - plot.x, enemy.y - plot.y);
      if (d <= stats.range && (!target || enemy.dist > target.dist)) target = enemy;
    }
    if (!target) return null;
    tower.cooldown = 1 / stats.rate;
    tower.angle = Math.atan2(target.y - plot.y, target.x - plot.x);
    tower.flash = 0.08;
    state.projectiles.push({
      x: plot.x, y: plot.y, target, kind: tower.kind,
      damage: stats.damage, speed: 520,
      splash: TOWERS[tower.kind].splash || 0,
      chain: TOWERS[tower.kind].chain || 0,
      slow: TOWERS[tower.kind].slow || 0,
      slowTime: TOWERS[tower.kind].slowTime || 0,
    });
    return tower.kind;
  }

  function stepProjectiles(dt) {
    for (const p of state.projectiles) {
      if (p.dead) continue;
      const target = p.target;
      const tx = target && !target.dead ? target.x : p.lastX ?? p.x;
      const ty = target && !target.dead ? target.y : p.lastY ?? p.y;
      if (target && !target.dead) {
        p.lastX = target.x;
        p.lastY = target.y;
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= Math.max(move, 10)) {
        p.dead = true;
        if (target && !target.dead) {
          const killed = damageEnemy(target, p.damage);
          if (p.slow) {
            target.slowFactor = 1 - p.slow;
            target.slowUntil = state.time + p.slowTime;
          }
          if (p.splash) applySplash(target, p.damage, p.splash, target);
          if (p.chain) applyChain(target, p.damage, p.chain);
          addParticles(target.x, target.y, '#ffffff', 4, 70);
          if (killed) return 'kill';
        }
      } else {
        p.x += (dx / dist) * move;
        p.y += (dy / dist) * move;
      }
    }
    state.projectiles = state.projectiles.filter((p) => !p.dead);
    return null;
  }

  function stepEnemies(dt) {
    let events = 0;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const slowed = state.time < enemy.slowUntil;
      const factor = slowed ? enemy.slowFactor : 1;
      enemy.dist += enemy.speed * factor * dt;
      const pos = positionAt(enemy.dist);
      enemy.x = pos.x + Math.sin(enemy.wobble + state.time * 3) * 3;
      enemy.y = pos.y + Math.cos(enemy.wobble * 1.3 + state.time * 2.4) * 3;
      enemy.angle = pos.angle;
      if (enemy.dist >= PATH_LENGTH) {
        enemy.dead = true;
        enemy.leaked = true;
        state.lives -= enemy.leak;
        addParticles(HEART.x, HEART.y, '#ff5a5a', 16, 140);
        events |= EVENT_LEAK;
        if (state.lives <= 0) {
          state.lives = 0;
          state.over = true;
          state.won = false;
          events |= EVENT_LOSE;
        }
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead);
    return events;
  }

  function stepParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.vx) p.vx *= 0.92;
      if (p.vy) p.vy *= 0.92;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) {
      f.life -= dt;
      f.y -= 26 * dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }

  function step(dt) {
    if (state.over) {
      stepParticles(dt);
      return 0;
    }
    state.time += dt;
    let events = 0;

    // Spawn the wave's queue.
    if (state.waveActive && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const next = state.spawnQueue.shift();
        spawnEnemy(next.kind, WAVES[state.wave - 1].hpMul);
        state.spawnTimer = next.gap;
      }
    }

    // Towers shoot.
    for (const tower of state.towers) {
      tower.cooldown -= dt;
      if (tower.flash > 0) tower.flash -= dt;
      if (tower.cooldown <= 0) {
        const fired = fireTower(tower);
        if (fired) state.lastShotKind = fired;
      }
    }

    const killEvent = stepProjectiles(dt);
    if (killEvent === 'kill') events |= EVENT_KILL;
    events |= stepEnemies(dt);
    stepParticles(dt);

    // Wave cleared: queue empty and no enemies left.
    if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      const bonus = waveBonus(state.wave);
      state.gold += bonus;
      state.score += bonus * 5;
      addFloater(HEART.x, HEART.y - 48, `Wave ${state.wave} clear! +${bonus}g`, '#7fe0a8');
      events |= EVENT_CLEAR;
      if (state.wave >= WAVE_COUNT) {
        state.over = true;
        state.won = true;
        events |= EVENT_WIN;
      }
    }
    return events;
  }

  function buildTower(plotIndex, kind) {
    const def = TOWERS[kind];
    if (state.over || state.towers.some((t) => t.plotIndex === plotIndex)) return false;
    if (state.gold < def.cost) return false;
    state.gold -= def.cost;
    state.towers.push({
      plotIndex, kind, level: 1, cooldown: 0, angle: -Math.PI / 2,
      invested: def.cost, flash: 0,
    });
    state.selectedPlot = -1;
    state.buildKind = null;
    return true;
  }

  function upgradeTower(towerIndex) {
    const tower = state.towers[towerIndex];
    if (!tower || tower.level >= MAX_LEVEL) return false;
    const cost = upgradeCost(tower.kind, tower.level);
    if (state.gold < cost) return false;
    state.gold -= cost;
    tower.invested += cost;
    tower.level += 1;
    addParticles(PLOTS[tower.plotIndex].x, PLOTS[tower.plotIndex].y, '#ffd94a', 12, 90);
    return true;
  }

  function sellTower(towerIndex) {
    const tower = state.towers[towerIndex];
    if (!tower) return 0;
    const refund = Math.round(tower.invested * SELL_RATE);
    state.gold += refund;
    state.towers.splice(towerIndex, 1);
    state.selectedTower = -1;
    return refund;
  }

  function reset() {
    state.gold = START_GOLD;
    state.lives = START_LIVES;
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.towers = [];
    state.enemies = [];
    state.projectiles = [];
    state.particles = [];
    state.floaters = [];
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.waveActive = false;
    state.over = false;
    state.won = false;
    state.selectedPlot = -1;
    state.selectedTower = -1;
    state.buildKind = null;
    state.time = 0;
  }

  return {
    state,
    step,
    startWave,
    buildTower,
    upgradeTower,
    sellTower,
    plotAt,
    towerAtPlot,
    towerStats,
    reset,
    pathLength: PATH_LENGTH,
  };
}

// UI geometry shared by render and the click handling in main.js.
export const UI = {
  topBar: { x: 0, y: 0, w: FIELD.width, h: 52 },
  startButton: { x: FIELD.width - 190, y: 10, w: 170, h: 32 },
  speedButton: { x: FIELD.width - 250, y: 10, w: 50, h: 32 },
  muteButton: { x: FIELD.width - 310, y: 10, w: 50, h: 32 },
  buildMenu: { w: 300, h: 118 },
  towerPanel: { w: 300, h: 132 },
};
