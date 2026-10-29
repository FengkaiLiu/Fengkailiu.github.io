// Lava Rising (Hot Footer), ported from the team's Unity project to a canvas.
// Levels, sprites and sounds come from public/hotfooter/game (see scripts/export-hotfooter.mjs).
// The rules follow the original C#: Player.cs (movement, double jump, wall jump, lava),
// LevelManager.cs (level order, timer, music), CameraFollow.cs and GUIManager.cs (HUD).

import { tr } from '../i18n';

const BASE = '/hotfooter/game/';

// ---------- Numbers straight from Player.cs and the project settings ----------
const FIXED_DT = 0.02; // TimeManager: Fixed Timestep
const GRAVITY = -9.81; // Physics2DSettings
const WALK = 2 * 100 * FIXED_DT; // speed * 100 * fixedDeltaTime = 4 units/s
const RUN_MULTIPLIER = 2;
const JUMP_DV = (25 * 10 * FIXED_DT) / 1; // AddForce(25 * jumpHeight) for one step, mass 1 = 5 units/s
const MAX_AIR_JUMPS = 1;
const WALL_CHECK = 0.7;
const TARGET_ELEVATION = 10; // LevelManager.targetElevation
// Player.prefab: BoxCollider2D size 1.05 x 1.45, offset (0.025, -0.22)
const BOX = { ox: 0.025, oy: -0.22, hw: 0.525, hh: 0.725 };
const LAVA_TILE = 'tileset_23';

type LevelId = 'level1' | 'level2' | 'level3' | 'secret';
const LEVEL_NAMES: Record<LevelId, string> = tr(
  { level1: 'Level 1', level2: 'Level 2', level3: 'Level 3', secret: 'Secret level' },
  { level1: '第 1 关', level2: '第 2 关', level3: '第 3 关', secret: '隐藏关卡' },
);
// LevelManager.NextLevel: Level 1's door -> Level 2 -> Level 3, whose gate wins the game.
// Level 2 hides a terminal that leads to the secret level; its back door returns to Level 3.
const NEXT: Partial<Record<LevelId, LevelId>> = { level1: 'level2', level2: 'level3' };

interface AtlasSprite { file: string; name: string; x: number; y: number; w: number; h: number; ppu: number }
interface LevelData {
  atlas: AtlasSprite[];
  layers: { name: string; solid: boolean; order: number; origin: { x: number; y: number }; tiles: [number, number, number, number, number][] }[];
  objects: { name: string; tag?: string; x: number; y: number; sx: number; sy: number; box?: { x: number; y: number; w: number; h: number }; sprite?: number; order?: number; background?: boolean }[];
  spawn: { x: number; y: number };
  camera: { size: number; min: { x: number; y: number }; max: { x: number; y: number }; smooth: number };
}
interface Manifest {
  levels: Record<LevelId, string>;
  player: Record<'idle' | 'run' | 'jump' | 'fall' | 'hurt', string[]>;
  audio: Record<'bgm' | 'title' | 'victory' | 'defeat' | 'secret' | 'hopeful' | 'groundJump' | 'airJump' | 'landing' | 'burnt', string>;
  title: string;
}

export type Button = 'left' | 'right' | 'jump' | 'run' | 'start';

export interface LavaRising {
  /** Hold or release a control (touch buttons on the console call this). */
  press(button: Button, down: boolean): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export interface LavaRisingOptions {
  ctx: AudioContext;
  /** Where the game's audio goes (the room's music bus, so the room reacts). */
  output: AudioNode;
  /** Called when the music changes: a track title, or null when it stops. */
  onMusic?: (title: string | null) => void;
  /** Dev only: skip the title screen and start on this level. */
  startLevel?: string;
}

const MUSIC_TITLES: Partial<Record<keyof Manifest['audio'], string>> = {
  title: 'Hotfooter Title Theme',
  bgm: 'Hotfooter BGM',
  secret: 'Secret Level BGM',
  hopeful: 'Hopeful',
  victory: 'Hotfooter Victory Music',
  defeat: 'Hotfooter Defeat Music',
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export async function mountLavaRising(canvas: HTMLCanvasElement, opts: LavaRisingOptions): Promise<LavaRising> {
  const manifest: Manifest = await (await fetch(BASE + 'manifest.json')).json();
  const levelData = Object.fromEntries(
    await Promise.all((Object.keys(manifest.levels) as LevelId[]).map(async (id) => [id, (await (await fetch(BASE + manifest.levels[id])).json()) as LevelData])),
  ) as Record<LevelId, LevelData>;
  // Every image any level or the player needs.
  const files = new Set<string>([manifest.title]);
  for (const d of Object.values(levelData)) for (const a of d.atlas) files.add(a.file);
  for (const frames of Object.values(manifest.player)) for (const f of frames) files.add(f);
  const images = new Map<string, HTMLImageElement>();
  await Promise.all([...files].map(async (f) => images.set(f, await loadImage(BASE + f))));

  const g = canvas.getContext('2d')!;

  // ---------- Collision shapes ----------
  // Unity generated each tile's physics shape from its sprite's transparency (the tileset
  // .meta has no hand-drawn shapes), so slopes and ragged edges only block where there are
  // pixels. Same here: a 16 x 16 solidity mask per sprite, row 0 at the top.
  const TILE_PX = 16;
  const maskCache = new Map<string, Uint8Array | null>(); // null: fully solid
  const maskFor = (a: AtlasSprite): Uint8Array | null => {
    const key = `${a.file}:${a.x},${a.y}`;
    if (maskCache.has(key)) return maskCache.get(key)!;
    const img = images.get(a.file);
    let mask: Uint8Array | null = null;
    if (img && a.w === TILE_PX && a.h === TILE_PX) {
      const c = document.createElement('canvas');
      c.width = c.height = TILE_PX;
      const cg = c.getContext('2d', { willReadFrequently: true })!;
      cg.drawImage(img, a.x, a.y, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
      const px = cg.getImageData(0, 0, TILE_PX, TILE_PX).data;
      const m = new Uint8Array(TILE_PX * TILE_PX);
      let filled = 0;
      for (let i = 0; i < m.length; i++) filled += m[i] = px[i * 4 + 3] > 0 ? 1 : 0;
      mask = filled === m.length ? null : m;
    }
    maskCache.set(key, mask);
    return mask;
  };

  // ---------- Audio ----------
  const { ctx } = opts;
  const out = ctx.createGain();
  out.connect(opts.output);
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const buffer = (key: keyof Manifest['audio']) => {
    if (!buffers.has(key)) {
      buffers.set(
        key,
        fetch(BASE + manifest.audio[key])
          .then((r) => r.arrayBuffer())
          .then((b) => ctx.decodeAudioData(b))
          .catch(() => null),
      );
    }
    return buffers.get(key)!;
  };
  void buffer('groundJump');
  void buffer('airJump');
  void buffer('landing');
  void buffer('burnt');
  const sfx = async (key: keyof Manifest['audio'], gain = 0.7) => {
    const b = await buffer(key);
    if (!b || disposed) return;
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    amp.gain.value = gain; // Player.cs: playerAS.volume = 0.7
    src.buffer = b;
    src.connect(amp).connect(out);
    src.start();
  };
  let music: { src: AudioBufferSourceNode; amp: GainNode; key: string } | null = null;
  let musicToken = 0;
  const playMusic = async (key: keyof Manifest['audio'], volume: number, loop = true) => {
    if (music?.key === key) return;
    stopMusic();
    const token = ++musicToken;
    const b = await buffer(key);
    if (!b || disposed || token !== musicToken) return;
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    src.buffer = b;
    src.loop = loop;
    amp.gain.setValueAtTime(0, ctx.currentTime);
    amp.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.4);
    src.connect(amp).connect(out);
    src.start();
    music = { src, amp, key };
    opts.onMusic?.(MUSIC_TITLES[key] ?? null);
  };
  function stopMusic() {
    musicToken++;
    if (!music) return;
    const { src, amp } = music;
    amp.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    src.stop(ctx.currentTime + 0.4);
    music = null;
    opts.onMusic?.(null);
  }

  // ---------- Input ----------
  const held = { left: false, right: false, run: false };
  let jumpQueued = false;
  let startQueued = false;
  const press = (b: Button, down: boolean) => {
    if (b === 'left' || b === 'right' || b === 'run') held[b] = down;
    else if (down && b === 'jump') {
      jumpQueued = true;
      startQueued = true; // A also confirms on the title and end screens
    } else if (down && b === 'start') startQueued = true;
  };
  const keyMap: Record<string, Button> = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyK: 'jump',
    Enter: 'start',
  };
  const onKey = (e: KeyboardEvent) => {
    const b = keyMap[e.code];
    if (!b) return;
    e.preventDefault();
    if (e.type === 'keydown' && e.repeat && (b === 'jump' || b === 'start')) return;
    press(b, e.type === 'keydown');
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------- World ----------
  let levelId: LevelId = 'level1';
  let level = levelData.level1;
  interface SolidTile {
    lava: boolean;
    mask: Uint8Array | null;
    fx: boolean;
    fy: boolean;
  }
  let solids = new Map<string, SolidTile>(); // "x,y" -> the tile there
  const loadLevel = (id: LevelId) => {
    levelId = id;
    level = levelData[id];
    solids = new Map();
    for (const layer of level.layers) {
      if (!layer.solid) continue;
      for (const [x, y, s, fx, fy] of layer.tiles) {
        const a = level.atlas[s];
        solids.set(`${x + layer.origin.x},${y + layer.origin.y}`, { lava: a.name === LAVA_TILE, mask: maskFor(a), fx: Boolean(fx), fy: Boolean(fy) });
      }
    }
    p.x = level.spawn.x;
    p.y = level.spawn.y;
    p.vx = p.vy = 0;
    p.airJumps = MAX_AIR_JUMPS;
    p.lowest = p.y;
    closeToWin = false;
    const cam0 = level.objects.find((o) => o.tag === 'MainCamera');
    cam.x = cam0?.x ?? p.x;
    cam.y = cam0?.y ?? p.y;
    banner = { text: LEVEL_NAMES[id], until: elapsedReal + 1.6 };
    void playMusic(id === 'secret' ? 'secret' : 'bgm', id === 'secret' ? 0.5 : 0.3);
  };
  /** Is the pixel at world point (x, y) solid? Tiles are 1 unit and 16 px; y points up. */
  const pixelSolid = (t: SolidTile, u: number, v: number) => {
    if (!t.mask) return true;
    let col = Math.min(Math.floor(u * TILE_PX), TILE_PX - 1);
    let row = TILE_PX - 1 - Math.min(Math.floor(v * TILE_PX), TILE_PX - 1); // mask rows run top-down
    if (t.fx) col = TILE_PX - 1 - col;
    if (t.fy) row = TILE_PX - 1 - row;
    return t.mask[row * TILE_PX + col] === 1;
  };
  const solidAt = (x: number, y: number) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const t = solids.get(`${tx},${ty}`);
    return Boolean(t && pixelSolid(t, x - tx, y - ty));
  };
  /** Physics2D.Raycast along a horizontal segment, sampled every quarter unit. */
  // Samples along the ray every quarter unit and always at its end. (The end used to be
  // skipped when the length wasn't a multiple of 0.25, so the 0.7 wall rays stopped at 0.5,
  // short of a wall the player was pressed against, and wall jumps never fired.)
  const rayHits = (x: number, y: number, dir: number, length: number) => {
    for (let d = 0; d < length; d += 0.25) if (solidAt(x + dir * d, y)) return true;
    return solidAt(x + dir * length, y);
  };

  const p = { x: 0, y: 0, vx: 0, vy: 0, airJumps: MAX_AIR_JUMPS, grounded: false, facingRight: true, lowest: 0, anim: 0 };
  const cam = { x: 0, y: 0 };
  type Mode = 'title' | 'play' | 'dying' | 'lost' | 'won';
  let mode: Mode = 'title';
  let modeAt = 0;
  let time = 0; // LevelManager.time: survives level changes (DontDestroyOnLoad)
  let closeToWin = false;
  let banner: { text: string; until: number } | null = null;
  let elapsedReal = 0;

  const setMode = (m: Mode) => {
    mode = m;
    modeAt = elapsedReal;
  };

  const startGame = () => {
    time = 0;
    setMode('play');
    loadLevel('level1');
  };

  const die = () => {
    if (mode !== 'play') return;
    setMode('dying');
    p.vx = 0;
    stopMusic();
    void sfx('burnt');
  };

  // Does the player's box, centred at (cx, cy), overlap any solid pixel? Reports lava too.
  const P = 1 / TILE_PX;
  const boxHit = (cx: number, cy: number): { lava: boolean } | null => {
    const left = cx - BOX.hw + 1e-4;
    const right = cx + BOX.hw - 1e-4;
    const bottom = cy - BOX.hh + 1e-4;
    const top = cy + BOX.hh - 1e-4;
    let hit: { lava: boolean } | null = null;
    for (let ty = Math.floor(bottom); ty <= Math.floor(top); ty++) {
      for (let tx = Math.floor(left); tx <= Math.floor(right); tx++) {
        const t = solids.get(`${tx},${ty}`);
        if (!t) continue;
        let solid = !t.mask;
        if (!solid) {
          // Only the pixels the box covers inside this tile.
          const c0 = Math.max(0, Math.floor((left - tx) * TILE_PX));
          const c1 = Math.min(TILE_PX - 1, Math.floor((right - tx) * TILE_PX));
          const r0 = Math.max(0, Math.floor((bottom - ty) * TILE_PX));
          const r1 = Math.min(TILE_PX - 1, Math.floor((top - ty) * TILE_PX));
          for (let v = r0; v <= r1 && !solid; v++) for (let u = c0; u <= c1 && !solid; u++) solid = pixelSolid(t, (u + 0.5) * P, (v + 0.5) * P);
        }
        if (!solid) continue;
        if (t.lava) return { lava: true };
        hit = { lava: false };
      }
    }
    return hit;
  };
  // Moving into lava burns; `probe` only asks (the slope helpers look ahead without touching).
  const freeAt = (x: number, y: number, probe = false) => {
    const hit = boxHit(x + BOX.ox, y + BOX.oy);
    if (hit?.lava && !probe) die();
    return !hit;
  };

  // Moves the box along one axis in small sweeps, stopping flush against the first solid
  // pixel (a binary search pins the contact). Returns true if it was blocked.
  const moveAxis = (dx: number, dy: number) => {
    const dist = Math.abs(dx || dy);
    const steps = Math.max(1, Math.ceil(dist / (P / 2)));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (freeAt(p.x + sx, p.y + sy)) {
        p.x += sx;
        p.y += sy;
        continue;
      }
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        if (freeAt(p.x + sx * mid, p.y + sy * mid)) lo = mid;
        else hi = mid;
      }
      p.x += sx * lo;
      p.y += sy * lo;
      return true;
    }
    return false;
  };

  // Walking: climb slopes and small bumps (up to 6 px) instead of stopping at them.
  const STEP_UP = 6 * P;
  const walk = (dx: number) => {
    if (!moveAxis(dx, 0)) return false;
    const rest = dx - (p.x - startX);
    if (p.grounded && p.vy <= 0 && Math.abs(rest) > 1e-6) {
      for (let up = P; up <= STEP_UP + 1e-6; up += P) {
        if (freeAt(p.x, p.y + up, true) && freeAt(p.x + rest, p.y + up, true)) {
          p.y += up;
          moveAxis(rest, 0);
          return false;
        }
      }
    }
    return true;
  };
  let startX = 0;

  const overlaps = (b: { x: number; y: number; w: number; h: number }) =>
    Math.abs(p.x + BOX.ox - b.x) < BOX.hw + b.w / 2 && Math.abs(p.y + BOX.oy - b.y) < BOX.hh + b.h / 2;

  const step = () => {
    if (mode !== 'play') return;
    time += FIXED_DT;

    // Player.Update: ground check, wall cling, jumps.
    const feet = p.y - 1;
    const crown = p.y + 0.5;
    const wasGrounded = p.grounded;
    // Player.cs's two feet rays, plus: resting on any solid pixel (on a slope the rays can pass
    // under the one corner that touches).
    p.grounded = rayHits(p.x, feet, -1, 0.5) || rayHits(p.x, feet, 1, 0.5) || (p.vy <= 0 && !freeAt(p.x, p.y - 2 / 16, true));
    if (p.grounded) {
      if (!wasGrounded) void sfx('landing');
      p.airJumps = MAX_AIR_JUMPS;
    }
    // Wall cling: Player.cs needs the head and feet rays to both touch the wall. Here any of
    // head, middle or feet will do, so you can keep wall jumping where only part of you is
    // against it (up near a wall's top edge, or past a ledge). Wall jumps are unlimited.
    const touches = (dir: number) => [crown, p.y + BOX.oy, feet].some((y) => rayHits(p.x, y, dir, WALL_CHECK));
    const wall = !p.grounded && (touches(-1) || touches(1));
    if (jumpQueued && (p.airJumps > 0 || wall)) {
      p.vy = JUMP_DV;
      if (!p.grounded) {
        if (!wall) {
          p.airJumps--;
          void sfx('airJump');
        } else void sfx('landing'); // the original reuses this clip for wall jumps
      } else void sfx('groundJump');
    }
    jumpQueued = false;

    // Player.FixedUpdate: horizontal speed is set outright; gravity pulls.
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    p.vx = dir * WALK * (held.run ? RUN_MULTIPLIER : 1);
    if (dir < 0) p.facingRight = false;
    else if (dir > 0) p.facingRight = true;
    p.vy += GRAVITY * FIXED_DT;
    startX = p.x;
    if (walk(p.vx * FIXED_DT)) p.vx = 0;
    if (mode !== 'play') return; // walked into lava
    const wasOnGround = p.grounded && p.vy <= 0;
    if (moveAxis(0, p.vy * FIXED_DT)) p.vy = 0;
    // Walking down a slope: stay on it instead of skipping down in little hops.
    else if (wasOnGround && p.vx !== 0) {
      for (let down = P; down <= STEP_UP + 1e-6; down += P) {
        if (!freeAt(p.x, p.y - down, true)) {
          p.y -= down - P;
          p.vy = 0;
          break;
        }
      }
    }
    if (mode !== 'play') return; // burnt this step

    // Fell out of the world: the lava got you anyway.
    if (p.y < level.camera.min.y - 12) die();
    p.lowest = Math.min(p.lowest, p.y);

    // Level 3: close to the top, the music lifts and the altimeter blinks.
    if (levelId === 'level3' && !closeToWin && p.y >= TARGET_ELEVATION * 0.75) {
      closeToWin = true;
      void playMusic('hopeful', 0.5);
    }

    // Triggers: doors, the gate, the secret terminal.
    for (const o of level.objects) {
      if (!o.box || !o.tag || !overlaps(o.box)) continue;
      if (o.tag === 'Door' && NEXT[levelId]) loadLevel(NEXT[levelId]!);
      else if (o.tag === 'Gate' && levelId === 'level3') {
        setMode('won');
        void playMusic('victory', 0.5, false);
      } else if (o.tag === 'Secret') loadLevel('secret');
      else if (o.tag === 'doorBack') loadLevel('level3');
      break;
    }

    // CameraFollow: lerp toward the player, clamped to the level's bounds.
    const k = Math.min(level.camera.smooth * FIXED_DT, 1);
    const tx = Math.min(Math.max(p.x, level.camera.min.x), level.camera.max.x);
    const ty = Math.min(Math.max(p.y, level.camera.min.y), level.camera.max.y);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  };

  // ---------- Drawing ----------
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const sprite = (s: AtlasSprite, wx: number, wy: number, ppuScreen: number, sx = 1, sy = 1, flipX = false) => {
    const img = images.get(s.file);
    if (!img) return;
    const w = (s.w / s.ppu) * ppuScreen * Math.abs(sx);
    const h = (s.h / s.ppu) * ppuScreen * Math.abs(sy);
    const [px, py] = toScreen(wx, wy, ppuScreen);
    g.save();
    g.translate(Math.round(px), Math.round(py));
    if (flipX) g.scale(-1, 1);
    g.drawImage(img, s.x, s.y, s.w, s.h, -w / 2, -h / 2, w, h);
    g.restore();
  };
  let viewCam = { x: 0, y: 0 };
  const toScreen = (wx: number, wy: number, ppu: number): [number, number] => [
    (wx - viewCam.x) * ppu + canvas.width / 2,
    canvas.height / 2 - (wy - viewCam.y) * ppu,
  ];

  const text = (s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center') => {
    g.font = `800 ${size}px "Nunito Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, size / 6);
    g.strokeStyle = 'rgba(20, 8, 30, 0.85)';
    g.strokeText(s, x, y);
    g.fillStyle = color;
    g.fillText(s, x, y);
  };
  const fmtTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;

  const draw = () => {
    const W = canvas.width;
    const H = canvas.height;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#120a1c';
    g.fillRect(0, 0, W, H);

    if (mode === 'title') {
      const img = images.get(manifest.title)!;
      const k = Math.max(W / img.width, H / img.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
      g.fillStyle = 'rgba(18, 10, 28, 0.35)';
      g.fillRect(0, 0, W, H);
      if (Math.floor(elapsedReal * 2) % 2 === 0) text(tr('Press A or Space to start', '按 A 或空格键开始'), W / 2, H * 0.84, H * 0.06, '#ffd59e');
      return;
    }

    // Camera units: orthographic size 5 means the view is 10 units tall.
    const ppu = H / (level.camera.size * 2);
    viewCam = { x: Math.round(cam.x * ppu) / ppu, y: Math.round(cam.y * ppu) / ppu };

    // Background: a child of the camera in Unity, so it fills the screen and never scrolls.
    const bg = level.objects.find((o) => o.background && o.sprite !== undefined);
    if (bg) {
      const s = level.atlas[bg.sprite!];
      const img = images.get(s.file)!;
      const k = Math.max(W / s.w, H / s.h);
      g.drawImage(img, s.x, s.y, s.w, s.h, (W - s.w * k) / 2, (H - s.h * k) / 2, s.w * k, s.h * k);
    }

    const decor = level.objects.filter((o) => o.sprite !== undefined && !o.background);
    const tileOrder = level.layers[0]?.order ?? 0;
    for (const o of decor) if ((o.order ?? 0) < tileOrder) sprite(level.atlas[o.sprite!], o.x, o.y, ppu, o.sx, o.sy);

    // Tiles, culled to the view.
    const halfW = W / ppu / 2 + 1;
    const halfH = H / ppu / 2 + 1;
    for (const layer of level.layers) {
      for (const [x, y, s, fx, fy] of layer.tiles) {
        const wx = x + layer.origin.x;
        const wy = y + layer.origin.y;
        if (Math.abs(wx + 0.5 - viewCam.x) > halfW || Math.abs(wy + 0.5 - viewCam.y) > halfH) continue;
        const a = level.atlas[s];
        const img = images.get(a.file)!;
        const [px, py] = toScreen(wx, wy + 1, ppu);
        const size = Math.ceil(ppu) + 1; // overlap a pixel so no seams show between tiles
        if (fx || fy) {
          g.save();
          g.translate(Math.round(px) + size / 2, Math.round(py) + size / 2);
          g.scale(fx ? -1 : 1, fy ? -1 : 1);
          g.drawImage(img, a.x, a.y, a.w, a.h, -size / 2, -size / 2, size, size);
          g.restore();
        } else g.drawImage(img, a.x, a.y, a.w, a.h, Math.round(px), Math.round(py), size, size);
      }
    }

    for (const o of decor) if ((o.order ?? 0) >= tileOrder) sprite(level.atlas[o.sprite!], o.x, o.y, ppu, o.sx, o.sy);

    // Lava shimmer: a warm glow pulsing over every lava tile.
    g.fillStyle = `rgba(255, 140, 40, ${0.12 + 0.08 * Math.sin(elapsedReal * 4)})`;
    for (const [key, lava] of solids) {
      if (!lava) continue;
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x + 0.5 - viewCam.x) > halfW || Math.abs(y + 0.5 - viewCam.y) > halfH) continue;
      const [px, py] = toScreen(x, y + 1, ppu);
      g.fillRect(Math.round(px), Math.round(py), Math.ceil(ppu), Math.ceil(ppu));
    }

    // The player: idle / run (walk plays the run frames slower) / jump / fall / hurt.
    const frames = manifest.player;
    let frame: string;
    if (mode === 'dying' || mode === 'lost') frame = frames.hurt[Math.floor(elapsedReal * 8) % frames.hurt.length];
    else if (!p.grounded) frame = p.vy > 0 ? frames.jump[0] : frames.fall[0];
    else if (Math.abs(p.vx) > 0.1) frame = frames.run[Math.floor(p.anim) % frames.run.length];
    else frame = frames.idle[Math.floor(p.anim) % frames.idle.length];
    const img = images.get(frame)!;
    sprite({ file: frame, name: 'player', x: 0, y: 0, w: img.width, h: img.height, ppu: 20 }, p.x, p.y, ppu, 1, 1, !p.facingRight);

    // GUIManager: the run timer and the altimeter.
    const pad = H * 0.04;
    text(fmtTime(time), pad, pad + H * 0.03, H * 0.055, '#fff', 'left');
    const barH = H * 0.6;
    const barW = Math.max(6, W * 0.014);
    const bx = W - pad - barW;
    const by = (H - barH) / 2;
    g.fillStyle = 'rgba(20, 8, 30, 0.6)';
    g.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.lineWidth = Math.max(1, H * 0.004);
    g.strokeRect(bx - 2, by - 2, barW + 4, barH + 4);
    text(tr('ALT', '高度'), bx + barW / 2, by - H * 0.035, H * 0.032);
    const fill = Math.min(Math.max((p.y - p.lowest) / Math.max(TARGET_ELEVATION - p.lowest, 0.001), 0), 1);
    const blinkOrange = closeToWin && Math.floor(elapsedReal * 2) % 2 === 0;
    g.fillStyle = blinkOrange ? 'rgb(240, 158, 58)' : 'rgb(0, 255, 255)';
    g.fillRect(bx, by + barH * (1 - fill), barW, barH * fill);

    if (banner && elapsedReal < banner.until) text(banner.text, W / 2, H * 0.2, H * 0.08, '#ffd59e');

    if (mode === 'dying' || mode === 'lost') {
      g.fillStyle = `rgba(80, 10, 0, ${Math.min((elapsedReal - modeAt) * 0.8, 0.55)})`;
      g.fillRect(0, 0, W, H);
      if (mode === 'lost') {
        text(tr('Burnt by the lava!', '被岩浆烫到了！'), W / 2, H * 0.42, H * 0.09, '#ff9d4d');
        text(tr('Press A or Space to try again', '按 A 或空格键再试一次'), W / 2, H * 0.58, H * 0.05);
      }
    }
    if (mode === 'won') {
      g.fillStyle = 'rgba(18, 10, 28, 0.5)';
      g.fillRect(0, 0, W, H);
      text(tr('You escaped the lava!', '你逃出了岩浆！'), W / 2, H * 0.38, H * 0.09, '#ffd59e');
      text(`${tr('Time', '用时')} ${fmtTime(time)}`, W / 2, H * 0.52, H * 0.06);
      text(tr('Press A or Space to play again', '按 A 或空格键再玩一次'), W / 2, H * 0.66, H * 0.045);
    }
  };

  // ---------- Loop ----------
  let disposed = false;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  if (opts.startLevel && opts.startLevel in levelData) {
    setMode('play');
    loadLevel(opts.startLevel as LevelId);
  } else void playMusic('title', 0.4);
  const loop = (now: number) => {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    elapsedReal += dt;

    if (startQueued) {
      startQueued = false;
      if (mode === 'title') {
        jumpQueued = false;
        startGame();
      } else if ((mode === 'lost' || mode === 'won') && elapsedReal - modeAt > 0.6) {
        jumpQueued = false;
        startGame();
      }
    }
    // Player.EndGameWithSound: the burn plays out, then the lose screen.
    if (mode === 'dying' && elapsedReal - modeAt > 1.6) {
      setMode('lost');
      void playMusic('defeat', 0.5, false);
    }

    acc += dt;
    while (acc >= FIXED_DT) {
      step();
      acc -= FIXED_DT;
    }
    p.anim += dt * (held.run ? 14 : Math.abs(p.vx) > 0.1 ? 9 : 7);
    draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // Dev-only test hook: lets a headless browser place the player and read back where it went.
  if (import.meta.env.DEV) (window as unknown as { __lava: unknown }).__lava = { player: p, held, press, loadLevel, mode: () => mode };

  return {
    press,
    setMuted(muted) {
      out.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      stopMusic();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      out.disconnect();
    },
  };
}
