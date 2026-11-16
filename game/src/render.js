// EMBERFALL's renderer: everything the player sees, drawn on one canvas.
// Night-ember palette: deep indigo ground, a glowing amber heart, warm tower
// colours against cool gloom enemies. Screens are drawn as overlays.
import {
  ENEMIES, FIELD, HEART, MAX_LEVEL, PATH, PLOT_RADIUS, PLOTS, TOWERS,
  TOWER_KINDS, WAVE_COUNT, upgradeCost,
} from './config.js';
import { UI } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const BG_TOP = '#171a2e';
const BG_BOTTOM = '#0d0f1c';
const PATH_COLOR = '#3a3f5c';
const PATH_EDGE = '#2a2e45';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(ctx, x, y, radius, time, lives, maxLives) {
  const pulse = 1 + Math.sin(time * 3) * 0.06;
  const glow = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius * 2.6);
  const hurt = lives <= 5;
  glow.addColorStop(0, hurt ? 'rgba(255,60,60,0.5)' : 'rgba(255,170,60,0.45)');
  glow.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Crystal: a faceted diamond.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.rotate(Math.PI / 4);
  const g = ctx.createLinearGradient(-radius, -radius, radius, radius);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.5, '#ffb347');
  g.addColorStop(1, '#ff7a2f');
  ctx.fillStyle = g;
  ctx.fillRect(-radius * 0.72, -radius * 0.72, radius * 1.44, radius * 1.44);
  ctx.strokeStyle = '#fff3cf';
  ctx.lineWidth = 2;
  ctx.strokeRect(-radius * 0.72, -radius * 0.72, radius * 1.44, radius * 1.44);
  ctx.restore();
  // Lives as a small bar under the heart.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x - 30, y + radius + 8, 60, 8, 4);
  ctx.fill();
  ctx.fillStyle = hurt ? '#ff5a5a' : '#7fe0a8';
  roundRect(ctx, x - 30, y + radius + 8, 60 * Math.max(0, lives / maxLives), 8, 4);
  ctx.fill();
}

function drawTower(ctx, x, y, kind, level, angle, flash, time) {
  const def = TOWERS[kind];
  const bob = Math.sin(time * 2 + x) * 1.5;
  // Base.
  ctx.fillStyle = '#232743';
  ctx.strokeStyle = '#4a5178';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Barrel / crystal pointing at the target.
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(angle);
  ctx.fillStyle = def.dark;
  ctx.fillRect(0, -5, 24, 10);
  ctx.restore();
  // Body: a gem per kind.
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = flash > 0 ? '#ffffff' : def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2;
  if (kind === 'ember') {
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'frost') {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a + Math.PI / 6) * 6, Math.sin(a + Math.PI / 6) * 6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(6, -2);
    ctx.lineTo(13, -2);
    ctx.lineTo(2, 6);
    ctx.lineTo(7, 6);
    ctx.lineTo(-4, 15);
    ctx.lineTo(-2, 3);
    ctx.lineTo(-11, 3);
    ctx.lineTo(1, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // Level pips.
  for (let i = 0; i < level; i += 1) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x - 10 + i * 10, y + 24, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(ctx, enemy, time) {
  const slowed = time < enemy.slowUntil;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, enemy.radius * 0.7, enemy.radius * 0.9, enemy.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = slowed ? '#9fd8ff' : enemy.color;
  ctx.strokeStyle = enemy.dark;
  ctx.lineWidth = 2;
  if (enemy.kind === 'grub') {
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(-4, -3, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'swift') {
    ctx.beginPath();
    ctx.moveTo(enemy.radius + 4, 0);
    ctx.lineTo(-enemy.radius * 0.7, -enemy.radius * 0.8);
    ctx.lineTo(-enemy.radius * 0.3, 0);
    ctx.lineTo(-enemy.radius * 0.7, enemy.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (enemy.kind === 'bulwark') {
    ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    ctx.strokeRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-enemy.radius + 3, -enemy.radius + 3, enemy.radius * 2 - 6, 6);
  } else if (enemy.kind === 'wisp') {
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Dreadmaw, the boss: a horned brute.
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a0a0a';
    ctx.beginPath();
    ctx.moveTo(-enemy.radius + 2, -enemy.radius + 6);
    ctx.lineTo(-enemy.radius - 8, -enemy.radius - 8);
    ctx.lineTo(-enemy.radius + 12, -enemy.radius - 2);
    ctx.closePath();
    ctx.moveTo(enemy.radius - 2, -enemy.radius + 6);
    ctx.lineTo(enemy.radius + 8, -enemy.radius - 8);
    ctx.lineTo(enemy.radius - 12, -enemy.radius - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(-8, -4, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // HP bar.
  if (enemy.hp < enemy.maxHp) {
    const w = enemy.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 10, w, 5);
    ctx.fillStyle = enemy.hp / enemy.maxHp > 0.4 ? '#7fe0a8' : '#ff5a5a';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 10, w * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width;
  const H = FIELD.height;

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, BG_TOP);
    g.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Faint drifting embers in the background.
    ctx.fillStyle = 'rgba(255,150,60,0.12)';
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 173 + 40) % W;
      const y = (i * 97 + ((time * 12 + i * 50) % 700)) % H;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Path.
    ctx.strokeStyle = PATH_EDGE;
    ctx.lineWidth = 46;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    // Path dashes: cobbles.
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 26]);
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Gate on the left.
    ctx.fillStyle = '#2a2e45';
    ctx.fillRect(0, PATH[0].y - 34, 14, 68);
    ctx.fillStyle = '#8a5cf6';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATE', 34, PATH[0].y - 26);
  }

  function drawPlots(state, pointer) {
    for (let i = 0; i < PLOTS.length; i += 1) {
      const plot = PLOTS[i];
      const hasTower = state.towers.some((t) => t.plotIndex === i);
      const isSelected = state.selectedPlot === i;
      const isHover = !hasTower && pointer.inside && Math.hypot(plot.x - pointer.x, plot.y - pointer.y) <= PLOT_RADIUS + 6;
      ctx.fillStyle = isSelected || isHover ? 'rgba(255,217,74,0.25)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = isSelected ? '#ffd94a' : isHover ? '#ffd94a' : '#4a5178';
      ctx.lineWidth = isSelected || isHover ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(plot.x, plot.y, PLOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!hasTower) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', plot.x, plot.y + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  function drawRange(x, y, range) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawHud(state, screen, best) {
    const bar = UI.topBar;
    ctx.fillStyle = 'rgba(10,12,24,0.92)';
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx.strokeStyle = '#2a2e45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bar.h);
    ctx.lineTo(W, bar.h);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffb347';
    ctx.fillText('EMBERFALL', 14, bar.h / 2 + 1);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`🪙 ${state.gold}`, 150, bar.h / 2);
    ctx.fillStyle = '#ff7a7a';
    ctx.fillText(`❤ ${state.lives}`, 250, bar.h / 2);
    ctx.fillStyle = '#e8ecff';
    ctx.fillText(`Wave ${Math.max(1, state.wave)}/${WAVE_COUNT}`, 330, bar.h / 2);
    ctx.fillStyle = '#9fb2ff';
    ctx.fillText(`Score ${state.score}`, 440, bar.h / 2);
    if (state.waveActive) {
      const left = state.spawnQueue.length + state.enemies.length;
      ctx.fillStyle = '#f5539e';
      ctx.fillText(`Foes left: ${left}`, 560, bar.h / 2);
    } else if (screen === SCREEN_PLAY && !state.over) {
      ctx.fillStyle = '#7fe0a8';
      ctx.fillText('Press Space for the next wave', 560, bar.h / 2);
    }
    // Buttons: mute, speed, start wave.
    const buttons = [
      { rect: UI.muteButton, label: state.muted ? '🔇' : '🔊' },
      { rect: UI.speedButton, label: state.speed === 2 ? '2×' : '1×' },
      { rect: UI.startButton, label: state.waveActive ? 'Fighting…' : state.wave >= WAVE_COUNT ? 'Done' : '▶ Start Wave' },
    ];
    for (const b of buttons) {
      ctx.fillStyle = b.rect === UI.startButton ? (state.waveActive ? '#3a3f5c' : '#ff7a2f') : '#232743';
      ctx.strokeStyle = '#4a5178';
      roundRect(ctx, b.rect.x, b.rect.y, b.rect.w, b.rect.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2 + 1);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawBuildMenu(state) {
    if (state.selectedPlot < 0) return null;
    const plot = PLOTS[state.selectedPlot];
    const menu = UI.buildMenu;
    let x = Math.min(Math.max(plot.x - menu.w / 2, 8), W - menu.w - 8);
    let y = plot.y - 150;
    if (y < 60) y = plot.y + 40;
    ctx.fillStyle = 'rgba(10,12,24,0.95)';
    ctx.strokeStyle = '#4a5178';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, menu.w, menu.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8ecff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Build a tower', x + 12, y + 22);
    const cards = [];
    TOWER_KINDS.forEach((kind, i) => {
      const def = TOWERS[kind];
      const cx = x + 12 + i * 94;
      const cy = y + 34;
      const affordable = state.gold >= def.cost;
      ctx.fillStyle = affordable ? '#232743' : '#1a1d30';
      ctx.strokeStyle = state.buildKind === kind ? '#ffd94a' : '#4a5178';
      ctx.lineWidth = state.buildKind === kind ? 2.5 : 1.5;
      roundRect(ctx, cx, cy, 86, 72, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(cx + 43, cy + 20, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, cx + 43, cy + 44);
      ctx.fillStyle = affordable ? '#ffd94a' : '#8a8fa8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`🪙 ${def.cost}`, cx + 43, cy + 60);
      ctx.fillStyle = '#9fb2ff';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(def.desc, cx + 43, cy + 72 - 8);
      cards.push({ kind, rect: { x: cx, y: cy, w: 86, h: 72 } });
    });
    ctx.textAlign = 'left';
    return { x, y, w: menu.w, h: menu.h, cards };
  }

  function drawTowerPanel(state) {
    if (state.selectedTower < 0) return null;
    const tower = state.towers[state.selectedTower];
    if (!tower) return null;
    const def = TOWERS[tower.kind];
    const stats = def.levels[tower.level - 1];
    const plot = PLOTS[tower.plotIndex];
    const panel = UI.towerPanel;
    let x = Math.min(Math.max(plot.x - panel.w / 2, 8), W - panel.w - 8);
    let y = plot.y - 170;
    if (y < 60) y = plot.y + 40;
    ctx.fillStyle = 'rgba(10,12,24,0.95)';
    ctx.strokeStyle = '#4a5178';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, panel.w, panel.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8ecff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${def.name} — Level ${tower.level}/${MAX_LEVEL}`, x + 12, y + 22);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#9fb2ff';
    ctx.fillText(`Damage ${stats.damage} · Range ${stats.range} · ${stats.rate}/s`, x + 12, y + 42);
    if (def.splash) ctx.fillText(`Splash ${def.splash}`, x + 12, y + 58);
    if (def.slow) ctx.fillText(`Slows ${Math.round(def.slow * 100)}%`, x + 12, y + 58);
    if (def.chain) ctx.fillText(`Chains to ${def.chain} foes`, x + 12, y + 58);
    // Upgrade button.
    const upRect = { x: x + 12, y: y + 74, w: 130, h: 34 };
    const canUp = tower.level < MAX_LEVEL;
    const upCost = canUp ? upgradeCost(tower.kind, tower.level) : 0;
    const affordUp = canUp && state.gold >= upCost;
    ctx.fillStyle = affordUp ? '#ff7a2f' : '#3a3f5c';
    roundRect(ctx, upRect.x, upRect.y, upRect.w, upRect.h, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(canUp ? `⬆ Upgrade 🪙${upCost}` : 'MAX LEVEL', upRect.x + upRect.w / 2, upRect.y + 22);
    // Sell button.
    const sellRect = { x: x + 158, y: y + 74, w: 130, h: 34 };
    ctx.fillStyle = '#232743';
    ctx.strokeStyle = '#4a5178';
    roundRect(ctx, sellRect.x, sellRect.y, sellRect.w, sellRect.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`Sell +${Math.round(tower.invested * 0.7)}g`, sellRect.x + sellRect.w / 2, sellRect.y + 22);
    ctx.textAlign = 'left';
    return { x, y, w: panel.w, h: panel.h, upRect, sellRect };
  }

  function drawOverlay(title, lines, accent, buttonLabel) {
    ctx.fillStyle = 'rgba(8,10,20,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 70);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, H / 2 - 18 + i * 28);
    });
    if (buttonLabel) {
      const bw = 260;
      const bh = 48;
      ctx.fillStyle = '#ff7a2f';
      roundRect(ctx, W / 2 - bw / 2, H / 2 + 66, bw, bh, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(buttonLabel, W / 2, H / 2 + 97);
    }
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    // A lively backdrop: the world idles behind the title.
    drawBackground(state.time);
    drawPlots(state, { x: -999, y: -999, inside: false });
    for (const tower of state.towers) {
      const plot = PLOTS[tower.plotIndex];
      drawTower(ctx, plot.x, plot.y, tower.kind, tower.level, tower.angle, 0, state.time);
    }
    drawHeart(ctx, HEART.x, HEART.y, HEART.radius, state.time, state.lives, 20);
    ctx.fillStyle = 'rgba(8,10,20,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('EMBERFALL', W / 2, 190);
    ctx.fillStyle = '#ffd94a';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Defend the Emberheart through 10 waves of Gloomlings', W / 2, 228);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Click a plot to build · Ember burns, Frost slows, Spark chains', W / 2, 268);
    ctx.fillText('1 / 2 / 3 pick a tower · Space starts a wave · F fast · P pause · M mute', W / 2, 294);
    if (best > 0) {
      ctx.fillStyle = '#7fe0a8';
      ctx.fillText(`Best score: ${best}`, W / 2, 326);
    }
    const bw = 280;
    const bh = 52;
    ctx.fillStyle = '#ff7a2f';
    roundRect(ctx, W / 2 - bw / 2, 360, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText('▶  Play', W / 2, 394);
    ctx.fillStyle = '#9fb2ff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Click or press Space to begin', W / 2, 446);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best, pointer) {
    ctx.clearRect(0, 0, W, H);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return { buildMenu: null, towerPanel: null };
    }
    drawBackground(state.time);
    drawPlots(state, pointer);
    // Range preview for the tower being placed or the selected one.
    if (state.buildKind && state.selectedPlot >= 0) {
      const plot = PLOTS[state.selectedPlot];
      drawRange(plot.x, plot.y, TOWERS[state.buildKind].range);
    }
    if (state.selectedTower >= 0 && state.towers[state.selectedTower]) {
      const tower = state.towers[state.selectedTower];
      const plot = PLOTS[tower.plotIndex];
      drawRange(plot.x, plot.y, TOWERS[tower.kind].levels[tower.level - 1].range);
    }
    // Heart, towers, enemies, projectiles, particles.
    drawHeart(ctx, HEART.x, HEART.y, HEART.radius, state.time, state.lives, 20);
    for (const tower of state.towers) {
      const plot = PLOTS[tower.plotIndex];
      drawTower(ctx, plot.x, plot.y, tower.kind, tower.level, tower.angle, tower.flash, state.time);
    }
    for (const enemy of state.enemies) drawEnemy(ctx, enemy, state.time);
    for (const p of state.projectiles) {
      ctx.fillStyle = p.kind === 'ember' ? '#ff9a3d' : p.kind === 'frost' ? '#9fd8ff' : '#ffe98a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'ember' ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.boltTo) {
        ctx.strokeStyle = '#ffe98a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.boltTo.x, p.boltTo.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    drawHud(state, screen, best);
    const buildMenu = drawBuildMenu(state);
    const towerPanel = drawTowerPanel(state);
    if (screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', ['Take a breath. The Gloomlings wait.', 'P or click to resume'], '#9fb2ff', null);
    } else if (screen === SCREEN_WIN) {
      drawOverlay('VICTORY!', [
        `The Emberheart still burns. Score ${state.score} · ${state.kills} foes felled`,
        best > 0 ? `Best score: ${best}` : 'A flawless defense!',
      ], '#7fe0a8', '↻  Play again');
    } else if (screen === SCREEN_LOSE) {
      drawOverlay('THE HEART FALLS', [
        `The Gloomlings broke through on wave ${state.wave}. Score ${state.score}`,
        best > 0 ? `Best score: ${best}` : 'Build, upgrade, and try again!',
      ], '#ff5a5a', '↻  Try again');
    }
    return { buildMenu, towerPanel };
  }

  return { draw };
}
