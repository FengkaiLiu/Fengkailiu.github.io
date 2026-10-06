// Exports Hot Footer (internally "Lava Rising") from the team's Unity repo into data the
// browser port can play: the real tilemaps, spawn points, doors, camera bounds, plus the
// sprites and audio they use. Run with: node scripts/export-hotfooter.mjs
//
// Unity scene files are YAML, so no Unity install is needed: we read the Tilemap,
// Transform, collider and prefab documents directly and resolve sprite references through
// the texture .meta files.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = 'https://raw.githubusercontent.com/GameDevGroup4/Unity-Project/main/Lava_Rising/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hotfooter', 'game');

// Build order from EditorBuildSettings: Main is Level 1, LevelS is the secret level.
const LEVELS = [
  { id: 'level1', scene: 'Assets/Scenes/Main.unity' },
  { id: 'level2', scene: 'Assets/Scenes/Level2.unity' },
  { id: 'level3', scene: 'Assets/Scenes/Level3.unity' },
  { id: 'secret', scene: 'Assets/Scenes/LevelS.unity' },
];

// Textures that tiles and props can come from. Their .meta files give us guid + sprite rects.
const TEXTURES = [
  'Assets/Super Grotto Escape/Environment/tileset/tileset.png',
  'Assets/Super Grotto Escape/Environment/back.png',
  'Assets/Super Grotto Escape/Environment/middle.png',
  'Assets/Super Grotto Escape/Environment/far.png',
  'Assets/Super Grotto Escape/Props/door.png',
  'Assets/Super Grotto Escape/Props/gate.png',
  'Assets/Super Grotto Escape/Props/terminal.png',
];

const PLAYER_FRAMES = {
  idle: [1, 2, 3, 4, 5, 6].map((i) => `Player-idle/player-idle${i}.png`),
  run: [1, 2, 3, 4, 5, 6].map((i) => `player-run/player-run${i}.png`),
  jump: ['Player-jump/player-jump1.png'],
  fall: ['Player-jump/player-fall.png'],
  hurt: ['Player-Hurt/player-hurt1.png', 'Player-Hurt/player-hurt2.png'],
};

// Fengkai's soundtrack (made with Suno) and the game's sound effects.
const AUDIO = {
  bgm: 'Assets/UI Toolkit/Audio/Hotfooter BGM.mp3',
  title: 'Assets/UI Toolkit/Audio/Hotfooter Title Theme.mp3',
  victory: 'Assets/UI Toolkit/Audio/Hotfooter Victory Music.mp3',
  defeat: 'Assets/UI Toolkit/Audio/Hotfooter Defeat Music.mp3',
  secret: 'Assets/UI Toolkit/Audio/Secret Level BGM.mp3',
  hopeful: 'Assets/Sounds/SC_hopeful.mp3',
  groundJump: 'Assets/Sounds/SC_ground_jump.wav',
  airJump: 'Assets/Sounds/SC_air_jump.wav',
  landing: 'Assets/Sounds/SC_landing.wav',
  burnt: 'Assets/Sounds/SC_burnt_by_lava.wav',
};

const url = (path) => RAW + path.split('/').map(encodeURIComponent).join('/');
async function text(path) {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.text();
}
async function bytes(path) {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}
async function save(rel, data) {
  const file = join(OUT, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  return rel.replaceAll('\\', '/');
}

// ---------- Tiny Unity-YAML helpers ----------
/** Split a scene into documents: { type, id, body }. */
function documents(yaml) {
  const docs = [];
  const re = /^--- !u!(\d+) &(-?\d+)(?: stripped)?\n/gm;
  const heads = [...yaml.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : yaml.length;
    docs.push({ type: Number(m[1]), id: m[2], body: yaml.slice(m.index + m[0].length, end) });
  });
  return docs;
}
const field = (body, name) => body.match(new RegExp(`^\\s*${name}: (.*)$`, 'm'))?.[1]?.trim();
const vec = (s) => {
  const o = {};
  for (const [, k, v] of (s ?? '').matchAll(/(\w+): (-?[\d.e+-]+)/g)) o[k] = Number(v);
  return o;
};
const ref = (s) => s?.match(/fileID: (-?\d+)/)?.[1];
const guidOf = (s) => s?.match(/guid: ([0-9a-f]+)/)?.[1];

/** Width/height from a PNG's IHDR chunk. */
function pngSize(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

// ---------- Textures: guid -> file, internalID -> sprite rect ----------
async function loadTextures() {
  const byGuid = new Map();
  for (const path of TEXTURES) {
    const [meta, png] = await Promise.all([text(path + '.meta'), bytes(path)]);
    const guid = field(meta, 'guid');
    const { w, h } = pngSize(png);
    const file = await save(`img/${path.split('/').pop()}`, png);
    const sprites = new Map();
    // Multi-sprite sheets list each slice with a name, a rect (origin bottom-left) and an internalID.
    for (const block of meta.split(/\n\s*- serializedVersion: 2\n/).slice(1)) {
      const name = field(block, 'name');
      const id = field(block, 'internalID');
      const rx = Number(block.match(/rect:[\s\S]*?x: (-?[\d.]+)/)?.[1]);
      const ry = Number(block.match(/rect:[\s\S]*?y: (-?[\d.]+)/)?.[1]);
      const rw = Number(block.match(/rect:[\s\S]*?width: ([\d.]+)/)?.[1]);
      const rh = Number(block.match(/rect:[\s\S]*?height: ([\d.]+)/)?.[1]);
      if (name && id && Number.isFinite(rw)) sprites.set(id, { name, x: rx, y: h - ry - rh, w: rw, h: rh });
    }
    // Single-sprite textures are referenced with the fixed fileID 21300000.
    sprites.set('21300000', { name: path.split('/').pop().replace('.png', ''), x: 0, y: 0, w, h });
    const ppu = Number(field(meta, 'spritePixelsToUnits') ?? 100);
    byGuid.set(guid, { file, w, h, ppu, sprites });
  }
  return byGuid;
}

// ---------- One level ----------
function exportLevel(yaml, textures) {
  const docs = documents(yaml);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const gameObjects = new Map();
  for (const d of docs.filter((d) => d.type === 1)) {
    gameObjects.set(d.id, { name: field(d.body, 'm_Name') ?? '', tag: field(d.body, 'm_TagString'), active: field(d.body, 'm_IsActive') !== '0', comps: {} });
  }
  // Index components by game object and type.
  for (const d of docs) {
    const go = ref(field(d.body, 'm_GameObject'));
    if (go && gameObjects.has(go)) (gameObjects.get(go).comps[d.type] ??= []).push(d);
  }
  const transformOf = (goId) => gameObjects.get(goId)?.comps[4]?.[0] ?? gameObjects.get(goId)?.comps[224]?.[0];
  /** World position and scale, walking up the parent chain (rotations are all identity here). */
  const world = (t) => {
    let pos = { x: 0, y: 0 };
    let scale = { x: 1, y: 1 };
    const chain = [];
    for (let cur = t; cur; cur = byId.get(ref(field(cur.body, 'm_Father')))) chain.unshift(cur);
    for (const c of chain) {
      const lp = vec(field(c.body, 'm_LocalPosition'));
      const ls = vec(field(c.body, 'm_LocalScale'));
      pos = { x: pos.x + (lp.x ?? 0) * scale.x, y: pos.y + (lp.y ?? 0) * scale.y };
      scale = { x: scale.x * (ls.x ?? 1), y: scale.y * (ls.y ?? 1) };
    }
    return { pos, scale };
  };
  const spriteRef = (s) => {
    const tex = textures.get(guidOf(s));
    const sprite = tex?.sprites.get(ref(s));
    return tex && sprite ? { tex, sprite } : null;
  };

  // Atlas of every sprite the level uses: index -> { file, x, y, w, h, name }.
  const atlas = [];
  const atlasIndex = new Map();
  const atlasOf = (r) => {
    const key = `${r.tex.file}#${r.sprite.name}`;
    if (!atlasIndex.has(key)) {
      atlasIndex.set(key, atlas.length);
      atlas.push({ file: r.tex.file, name: r.sprite.name, x: r.sprite.x, y: r.sprite.y, w: r.sprite.w, h: r.sprite.h, ppu: r.tex.ppu });
    }
    return atlasIndex.get(key);
  };

  // Tilemaps (class 1839735485). Solid if the same object has a TilemapCollider2D (19719996).
  const layers = [];
  for (const [goId, go] of gameObjects) {
    const tm = go.comps[1839735485]?.[0];
    if (!tm || !go.active) continue;
    const renderer = go.comps[483693784]?.[0];
    const { pos } = world(transformOf(goId));
    const spriteArray = [...tm.body.split('m_TileSpriteArray:')[1].split(/\n  m_\w+:/)[0].matchAll(/m_Data: (\{[^}]*\})/g)].map((m) => m[1]);
    const matrixBlock = tm.body.split('m_TileMatrixArray:')[1]?.split(/\n  m_\w+:/)[0] ?? '';
    const matrices = [...matrixBlock.matchAll(/e00: (-?[\d.]+)[\s\S]*?e01: (-?[\d.]+)[\s\S]*?e10: (-?[\d.]+)[\s\S]*?e11: (-?[\d.]+)/g)].map((m) => m.slice(1, 5).map(Number));
    const tiles = [];
    for (const m of tm.body.matchAll(/- first: \{x: (-?\d+), y: (-?\d+), z: -?\d+\}\n\s+second:[\s\S]*?m_TileSpriteIndex: (\d+)\n\s+m_TileMatrixIndex: (\d+)/g)) {
      const r = spriteRef(spriteArray[Number(m[3])]);
      if (!r) continue;
      const mat = matrices[Number(m[4])] ?? [1, 0, 0, 1];
      tiles.push([Number(m[1]), Number(m[2]), atlasOf(r), mat[0] < 0 ? 1 : 0, mat[3] < 0 ? 1 : 0]);
    }
    layers.push({
      name: go.name,
      solid: Boolean(go.comps[19719996]),
      order: Number(field(renderer?.body ?? '', 'm_SortingOrder') ?? 0),
      origin: pos,
      tiles,
    });
  }
  layers.sort((a, b) => a.order - b.order);

  // Tagged triggers (doors, gate, secret passage) and plain sprites (decorations, background).
  const objects = [];
  for (const [goId, go] of gameObjects) {
    if (!go.active) continue;
    const t = transformOf(goId);
    if (!t) continue;
    const { pos, scale } = world(t);
    const box = go.comps[61]?.[0];
    const sr = go.comps[212]?.[0];
    const sprite = sr ? spriteRef(field(sr.body, 'm_Sprite')) : null;
    const tag = go.tag && go.tag !== 'Untagged' ? go.tag : undefined;
    if (!tag && !sprite) continue;
    const o = { name: go.name, tag, x: pos.x, y: pos.y, sx: scale.x, sy: scale.y };
    if (box) {
      const size = vec(field(box.body, 'm_Size'));
      const off = vec(field(box.body, 'm_Offset'));
      o.box = { x: pos.x + (off.x ?? 0) * scale.x, y: pos.y + (off.y ?? 0) * scale.y, w: (size.x ?? 1) * Math.abs(scale.x), h: (size.y ?? 1) * Math.abs(scale.y) };
    }
    if (sprite) {
      o.sprite = atlasOf(sprite);
      o.order = Number(field(sr.body, 'm_SortingOrder') ?? 0);
    }
    if (go.name === 'Background') o.background = true;
    objects.push(o);
  }

  // Player spawn: the Player prefab instance's position override.
  const prefab = docs.find((d) => d.type === 1001 && /m_SourcePrefab:.*guid: 77a7b7165ea8f054ea44edb0a7214e17/.test(d.body));
  const mod = (p) => Number(prefab?.body.match(new RegExp(`propertyPath: ${p}\\n\\s+value: (-?[\\d.e+-]+)`))?.[1] ?? 0);
  const spawn = { x: mod('m_LocalPosition.x'), y: mod('m_LocalPosition.y') };

  // Camera: orthographic size and the CameraFollow clamp.
  const camDoc = docs.find((d) => d.type === 20);
  const follow = docs.find((d) => d.type === 114 && /minValues:/.test(d.body));
  const camera = {
    size: Number(field(camDoc?.body ?? '', 'orthographic size') ?? 5),
    min: vec(field(follow?.body ?? '', 'minValues')),
    max: vec(field(follow?.body ?? '', 'maxValues')),
    smooth: Number(field(follow?.body ?? '', 'smooth') ?? 3),
  };

  return { atlas, layers, objects, spawn, camera };
}

// ---------- Run ----------
await mkdir(OUT, { recursive: true });
const textures = await loadTextures();
console.log(`textures: ${[...textures.values()].map((t) => `${t.file} (${t.sprites.size} sprites)`).join(', ')}`);

const levels = {};
for (const lvl of LEVELS) {
  const data = exportLevel(await text(lvl.scene), textures);
  levels[lvl.id] = await save(`${lvl.id}.json`, JSON.stringify(data));
  const tiles = data.layers.reduce((n, l) => n + l.tiles.length, 0);
  console.log(`${lvl.id}: ${data.layers.length} layers, ${tiles} tiles, spawn ${JSON.stringify(data.spawn)}, objects ${data.objects.map((o) => o.tag ?? o.name).join(', ')}`);
}

const player = {};
for (const [anim, frames] of Object.entries(PLAYER_FRAMES)) {
  player[anim] = [];
  for (const f of frames) player[anim].push(await save(`img/player/${f.split('/').pop()}`, await bytes(`Assets/Super Grotto Escape/Characters/Player/${f}`)));
}
// The original title screen art.
const title = await save('img/StartImage.png', await bytes('Assets/UI Toolkit/Images/StartImage.png'));
const audio = {};
for (const [key, path] of Object.entries(AUDIO)) audio[key] = await save(`audio/${path.split('/').pop().replaceAll(' ', '-')}`, await bytes(path));

await save('manifest.json', JSON.stringify({ source: 'https://github.com/GameDevGroup4/Unity-Project', exported: new Date().toISOString().slice(0, 10), levels, player, audio, title }, null, 2));
console.log('done:', OUT);
