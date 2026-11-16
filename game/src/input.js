// Mouse and keyboard input for EMBERFALL. The canvas is scaled to fit the
// window, so mouse coordinates are mapped back into field space. Actions are
// consumed once per frame by the game loop (takeActions), while the pointer
// position is always live for hover previews.
export const ACTION_START = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_SPEED = 1 << 2;
export const ACTION_MUTE = 1 << 3;
export const ACTION_CANCEL = 1 << 4;
export const ACTION_RESTART = 1 << 5;

export function createInput(canvas) {
  let actions = 0;
  let click = null;
  let pointer = { x: -999, y: -999, inside: false };
  let pickedKind = null;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const p = toField(event);
    pointer = { x: p.x, y: p.y, inside: true };
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = { x: -999, y: -999, inside: false };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toField(event);
    click = { x: p.x, y: p.y };
    event.preventDefault();
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'enter') {
      actions |= ACTION_START;
      event.preventDefault();
    } else if (key === 'p' || key === 'escape') {
      actions |= key === 'p' ? ACTION_PAUSE : ACTION_CANCEL;
    } else if (key === 'f') {
      actions |= ACTION_SPEED;
    } else if (key === 'm') {
      actions |= ACTION_MUTE;
    } else if (key === 'r') {
      actions |= ACTION_RESTART;
    } else if (key === '1' || key === '2' || key === '3') {
      pickedKind = ['ember', 'frost', 'spark'][Number(key) - 1];
    }
  });

  return {
    get pointer() {
      return pointer;
    },
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
    takePickedKind() {
      const k = pickedKind;
      pickedKind = null;
      return k;
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
