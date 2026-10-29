// Hot Footer, under the hood: four pieces of Fengkai's C# from the Unity repo, each next to
// a diagram you can play with, then the team's six weeks of commits as an arrangement view.
// Code excerpts are quoted from GameDevGroup4/Unity-Project (Player.cs, CameraFollow.cs).
// Mounted into the liner notes on demand; dispose() stops every loop and listener.
import { locale, tr } from '../i18n';

const IMG_PLAYER = '/hotfooter/game/img/player/player-idle1.png';
const LEVEL1 = '/hotfooter/game/level1.json';
const COMMITS = '/hotfooter/commits.json';

// The numbers the diagrams use are the game's own (see src/games/lavaRising.ts).
const BOX = { ox: 0.025, oy: -0.22, hw: 0.525, hh: 0.725 };
const FIXED_DT = 0.02;
const G = 9.81;

/** Rough label width in the timeline's 10 px type: CJK characters run about twice as wide. */
const labelWidth = (s: string) => [...s].reduce((w, ch) => w + (ch > '⹿' ? 10.5 : 6.2), 0);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A small C# highlighter: comments, strings, numbers, keywords, Unity types. */
function highlight(code: string) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|\b(\d+(?:\.\d+)?f?)\b|\b(private|public|static|bool|float|int|void|if|else|return|new|true|false|string)\b|\b(Vector2|Vector3|Physics2D|Mathf|SceneManager|LevelManager|Debug|Time|Range|Transform)\b/gm;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'k' : 't';
    out += `<span class="tok-${cls}">${esc(m[0])}</span>`;
    last = m.index! + m[0].length;
  }
  return out + esc(code.slice(last));
}

const CODE_GROUND = `crown = new Vector2(transform.position.x, transform.position.y + 0.5f);
feet = new Vector2(transform.position.x, transform.position.y - 1f);

private void checkGroundCollision()
{
    bool groundCheckL = Physics2D.Raycast(feet, Vector2.left, 0.5f, groundMask);
    bool groundCheckR = Physics2D.Raycast(feet, Vector2.right, 0.5f, groundMask);

    // Check if grounded, refresh jumps if so
    if (groundCheckL || groundCheckR)
    {
        isGrounded = true;
        airJumps = maxAirJumps;
    }
    else
    {
        isGrounded = false;
    }
}`;

const CODE_JUMP = `private float jumpHeight = 10f;

if (Input.GetButtonDown("Jump") && (airJumps > 0 || wall != 0))
{
    rb.velocity = new Vector2(rb.velocity.x, 0f);
    rb.AddForce(new Vector2(0f, 25 * jumpHeight));
}`;

const CODE_CAMERA = `public Vector3 minValues, maxValues;
[Range(1, 10)] public float smooth;

void Follow()
{
    Vector3 targetPos = target.position + offset;
    Vector3 boundPosition = new Vector3(
        Mathf.Clamp(targetPos.x, minValues.x, maxValues.x),
        Mathf.Clamp(targetPos.y, minValues.y, maxValues.y),
        Mathf.Clamp(targetPos.z, minValues.z, maxValues.z));
    Vector3 smoothPos = Vector3.Lerp(transform.position, boundPosition, smooth * Time.fixedDeltaTime);
    transform.position = smoothPos;
}`;

const CODE_SECRET = `if (collision.CompareTag("Secret"))
{
    if (LevelManager.chooseMusic == "Harry")
    {
        SceneManager.LoadScene("Scenes/LevelS");
    }
    else
    {
        Debug.Log("Secret level inaccessible with Ava's music.");
    }
}`;

const pre = (code: string, file: string) =>
  `<figure class="deep__code"><figcaption>${esc(file)}</figcaption><pre><code>${highlight(code)}</code></pre></figure>`;

/** Keep a canvas's backing store matched to its CSS size. Returns the device pixel scale. */
function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function mountLavaDeepDive(host: HTMLElement): { dispose(): void } {
  host.innerHTML = `
    <h3>${tr('Under the hood', '代码幕后')}</h3>
    <p>${tr(
      "Four pieces of my code from the Unity project, each with a diagram you can play with. The numbers in the diagrams are the game's own.",
      '下面是我在 Unity 项目里写的四段代码，每段都配了一个可以上手玩的示意图。图里的数值都和游戏本身一致。',
    )}</p>

    <section class="deep__part">
      <h4>${tr('1 · Am I standing on something? The ground check', '1 · 我脚下有东西吗？地面检测')}</h4>
      <p>${tr(
        `Two short rays leave the player's feet, one to each side. If either one touches a tile on the ground layer, the player is grounded and the air jump refills. Drag the hero around: <b class="deep__key deep__key--mine">orange</b> is my ground check. The <b class="deep__key deep__key--team">blue</b> head and feet rays are the wall check my teammate nbalog7 built on the same idea.`,
        `从角色脚下向左右各射出一条短射线。只要有一条碰到地面层的砖块，角色就算着地，空中跳跃的次数也会回满。拖动小人试试：<b class="deep__key deep__key--mine">橙色</b>是我写的地面检测；<b class="deep__key deep__key--team">蓝色</b>的头部和脚部射线，是队友 nbalog7 基于同样思路做的墙面检测。`,
      )}</p>
      <div class="deep__split">
        ${pre(CODE_GROUND, tr('Player.cs (trimmed)', 'Player.cs（节选）'))}
        <div class="deep__viz">
          <canvas class="deep__canvas deep__canvas--rays" data-rays tabindex="0" aria-label="${tr('Ray diagram: drag the hero, or use the arrow keys', '射线示意图：拖动小人，或者用方向键')}"></canvas>
          <p class="deep__readout" data-rays-out aria-live="polite"></p>
        </div>
      </div>
    </section>

    <section class="deep__part">
      <h4>${tr('2 · Making the double jump matter', '2 · 让二段跳变得必不可少')}</h4>
      <p>${tr(
        'A jump is one push: <code>AddForce</code> for a single 0.02 s physics step on a 1 kg body, so the speed it adds is 25 × jumpHeight × 0.02. At my first value of 20 that is 10 units/s, enough to clear five tiles in one hop. I halved it so the platforms ask for the double jump. From the commit:',
        '一次跳跃就是推一下：在单个 0.02 秒的物理步里对 1 kg 的刚体施加 <code>AddForce</code>，所以它增加的速度是 25 × jumpHeight × 0.02。我最初设的 20 对应每秒 10 个单位，一跳就能越过五格砖。我把它减半，让平台必须用二段跳才能过去。提交记录里是这样写的：',
      )} <q lang="en">Make adjustment to jump: 20 ---> 10 so that player need to use more double jump to go through the platform.</q></p>
      <div class="deep__split">
        ${pre(CODE_JUMP, tr('Player.cs (trimmed)', 'Player.cs（节选）'))}
        <div class="deep__viz">
          <div class="deep__toggle" role="group" aria-label="${tr('Jump force', '跳跃力')}">
            <button type="button" data-jump="20" aria-pressed="false">jumpHeight = 20 ${tr('(before)', '（修改前）')}</button>
            <button type="button" data-jump="10" aria-pressed="true">jumpHeight = 10 ${tr('(shipped)', '（最终版）')}</button>
          </div>
          <canvas class="deep__canvas deep__canvas--jump" data-jump-canvas aria-label="${tr('Jump arcs', '跳跃轨迹')}"></canvas>
          <p class="deep__readout" data-jump-out></p>
        </div>
      </div>
    </section>

    <section class="deep__part">
      <h4>${tr('3 · A camera that follows without jerking', '3 · 跟得上又不抖的镜头')}</h4>
      <p>${tr(
        'Each physics step the camera moves a fraction of the way toward the player (a linear interpolation), then it is clamped so it never shows past the edge of the level. This is the real Level 1 map. Move your pointer over it to steer the player, and drag the slider: it is the same <code>[Range(1, 10)] smooth</code> field the Unity inspector shows.',
        '每个物理步，镜头都朝玩家移动一小段距离（线性插值），再被限制在范围内，永远不会拍到关卡边界之外。这是真实的第 1 关地图。把指针移到上面就能操控玩家，再拖动滑块试试：它就是 Unity Inspector 里那个 <code>[Range(1, 10)] smooth</code> 字段。',
      )}</p>
      <div class="deep__split">
        ${pre(CODE_CAMERA, 'CameraFollow.cs')}
        <div class="deep__viz">
          <canvas class="deep__canvas deep__canvas--cam" data-cam aria-label="${tr('Camera follow diagram on the Level 1 map', '第 1 关地图上的镜头跟随示意图')}"></canvas>
          <label class="deep__slider">smooth <input type="range" min="1" max="10" step="1" value="3" data-smooth /> <output data-smooth-out>3</output></label>
          <p class="deep__readout" data-cam-out></p>
        </div>
      </div>
    </section>

    <section class="deep__part">
      <h4>${tr('4 · Two soundtracks, one secret', '4 · 两套配乐，一个秘密')}</h4>
      <p>${tr(
        'On the title screen you pick whose music plays: Harry (me) or Ava. The choice follows you into every level, and it also decides whether the terminal in Level 2 does anything. Pick one and walk into the terminal.',
        '在标题画面上，你可以选用谁的音乐：Harry（我）或 Ava。这个选择会跟着你进入每一关，也决定了第 2 关的终端会不会有反应。选一个，然后走进终端试试。',
      )}</p>
      <div class="deep__split">
        ${pre(CODE_SECRET, 'Player.cs · OnTriggerEnter2D')}
        <div class="deep__viz deep__secret">
          <div class="deep__toggle" role="group" aria-label="${tr('Soundtrack', '配乐')}">
            <button type="button" data-music="Harry" aria-pressed="true">Harry</button>
            <button type="button" data-music="Ava" aria-pressed="false">Ava</button>
          </div>
          <button type="button" class="btn btn--ghost deep__terminal" data-terminal>${tr('Walk into the terminal', '走进终端')}</button>
          <pre class="deep__console" data-console aria-live="polite">&gt; ${tr('waiting for the player…', '等待玩家…')}</pre>
        </div>
      </div>
    </section>

    <section class="deep__part">
      <h4>${tr('Six weeks in commits', '六周的提交记录')}</h4>
      <p>${tr(
        'All 39 commits, laid out like tracks in a DAW: one lane per teammate, time running left to right. Hover or focus a clip to read it.',
        '全部 39 次提交，像 DAW 里的音轨一样排开：每位队友一条轨道，时间从左往右走。把指针悬停在片段上（或用键盘聚焦）就能看到提交内容。',
      )}</p>
      <div class="deep__timeline" data-timeline><p class="deep__readout">${tr('Loading the history…', '正在加载提交历史…')}</p></div>
    </section>
  `;

  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts));
  };
  const frameFns: ((dt: number, now: number) => void)[] = [];
  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const fn of frameFns) fn(dt, now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const lamp = css('--lamp-300', '#ffd59e');
  const lampDeep = css('--lamp-500', '#ff9d4d');
  const moon = css('--moon-300', '#a9c4ff');
  const tileFill = '#2c6fae';
  const tileEdge = '#5fb3ff';
  const lava = '#ff8a2a';

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const playerImg = new Image();
  playerImg.src = IMG_PLAYER;

  // ---------- 1 · Rays ----------
  {
    const canvas = host.querySelector<HTMLCanvasElement>('[data-rays]')!;
    const out = host.querySelector<HTMLElement>('[data-rays-out]')!;
    const g = canvas.getContext('2d')!;
    const MAP = [
      '##............',
      '#.............',
      '#.............',
      '#........####.',
      '#.............',
      '#.............',
      '#.....###.....',
      '##############',
    ];
    const H = MAP.length;
    const W = MAP[0].length;
    const solid = (x: number, y: number) => {
      const row = H - 1 - Math.floor(y);
      return MAP[row]?.[Math.floor(x)] === '#';
    };
    /** First hit distance along a horizontal ray, or null. */
    const ray = (x: number, y: number, dir: number, len: number) => {
      for (let d = 0; d <= len + 1e-6; d += 0.02) if (solid(x + dir * d, y)) return d;
      return null;
    };
    const hero = { x: 3.2, y: 1 + BOX.hh - BOX.oy }; // standing on the floor
    let dragging = false;
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: H - ((e.clientY - r.top) / r.height) * H };
    };
    const clampHero = () => {
      hero.x = Math.min(Math.max(hero.x, 0.6), W - 0.6);
      hero.y = Math.min(Math.max(hero.y, 1.2), H - 0.6);
    };
    on(canvas, 'pointerdown', (e) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      Object.assign(hero, toWorld(e));
      clampHero();
    });
    on(canvas, 'pointermove', (e) => {
      if (!dragging) return;
      Object.assign(hero, toWorld(e));
      clampHero();
    });
    on(canvas, 'pointerup', () => (dragging = false));
    on(canvas, 'keydown', (e) => {
      const step = 0.1;
      if (e.key === 'ArrowLeft') hero.x -= step;
      else if (e.key === 'ArrowRight') hero.x += step;
      else if (e.key === 'ArrowUp') hero.y += step;
      else if (e.key === 'ArrowDown') hero.y -= step;
      else return;
      e.preventDefault();
      clampHero();
    });

    frameFns.push(() => {
      const dpr = fit(canvas);
      const cw = canvas.width;
      const ch = canvas.height;
      const u = cw / W;
      const sx = (x: number) => x * u;
      const sy = (y: number) => ch - y * u;
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = '#141024';
      g.fillRect(0, 0, cw, ch);
      // grid
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1;
      for (let x = 0; x <= W; x++) {
        g.beginPath();
        g.moveTo(sx(x), 0);
        g.lineTo(sx(x), ch);
        g.stroke();
      }
      for (let y = 0; y <= H; y++) {
        g.beginPath();
        g.moveTo(0, sy(y));
        g.lineTo(cw, sy(y));
        g.stroke();
      }
      for (let row = 0; row < H; row++) {
        for (let col = 0; col < W; col++) {
          if (MAP[row][col] !== '#') continue;
          const y = H - 1 - row;
          g.fillStyle = tileFill;
          g.fillRect(sx(col) + 1, sy(y + 1) + 1, u - 2, u - 2);
          g.strokeStyle = tileEdge;
          g.strokeRect(sx(col) + 1.5, sy(y + 1) + 1.5, u - 3, u - 3);
        }
      }
      // sprite + collider
      if (playerImg.complete && playerImg.naturalWidth) {
        g.imageSmoothingEnabled = false;
        g.globalAlpha = 0.9;
        g.drawImage(playerImg, sx(hero.x - 0.8), sy(hero.y + 0.95), 1.6 * u, 1.9 * u);
        g.globalAlpha = 1;
      }
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.setLineDash([4 * dpr, 3 * dpr]);
      g.strokeRect(sx(hero.x + BOX.ox - BOX.hw), sy(hero.y + BOX.oy + BOX.hh), BOX.hw * 2 * u, BOX.hh * 2 * u);
      g.setLineDash([]);

      const crown = hero.y + 0.5;
      const feet = hero.y - 1;
      const drawRay = (y: number, dir: number, len: number, color: string, width: number) => {
        const hit = ray(hero.x, y, dir, len);
        g.strokeStyle = color;
        g.globalAlpha = hit === null ? 0.35 : 1;
        g.lineWidth = width * dpr;
        g.beginPath();
        g.moveTo(sx(hero.x), sy(y));
        g.lineTo(sx(hero.x + dir * len), sy(y));
        g.stroke();
        if (hit !== null) {
          g.fillStyle = color;
          g.beginPath();
          g.arc(sx(hero.x + dir * hit), sy(y), 4 * dpr, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        return hit !== null;
      };
      // Teammate's wall check (drawn first, under mine).
      const wl = drawRay(crown + 0.04, -1, 0.7, moon, 2) && drawRay(feet + 0.08, -1, 0.7, moon, 2);
      const wr = drawRay(crown + 0.04, 1, 0.7, moon, 2) && drawRay(feet + 0.08, 1, 0.7, moon, 2);
      // My ground check.
      const gl = drawRay(feet, -1, 0.5, lampDeep, 3);
      const gr = drawRay(feet, 1, 0.5, lampDeep, 3);
      for (const [y, label] of [[crown, 'crown'], [feet, 'feet']] as const) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(sx(hero.x), sy(y), 3.5 * dpr, 0, Math.PI * 2);
        g.fill();
        g.font = `700 ${11 * dpr}px "JetBrains Mono Variable", monospace`;
        g.fillText(label, sx(hero.x) + 6 * dpr, sy(y) - 6 * dpr);
      }

      const grounded = gl || gr;
      const wall = wl ? 1 : wr ? 2 : 0;
      const jump = grounded ? tr('ground jump', '地面跳') : wall ? tr('wall jump', '蹬墙跳') : tr('air jump (if one is left)', '空中跳（如果还剩一次）');
      const side = wall ? (wall === 1 ? tr(' (left)', '（左）') : tr(' (right)', '（右）')) : '';
      out.innerHTML = `<code>isGrounded = ${grounded}</code> · <code>wallCling() = ${wall}${side}</code> · ${tr('Space now', '现在按空格')}: <b>${jump}</b>`;
    });
  }

  // ---------- 2 · Jump arcs ----------
  {
    const canvas = host.querySelector<HTMLCanvasElement>('[data-jump-canvas]')!;
    const out = host.querySelector<HTMLElement>('[data-jump-out]')!;
    const g = canvas.getContext('2d')!;
    let force = 10;
    let t = 0;
    host.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((b) =>
      on(b, 'click', () => {
        force = Number(b.dataset.jump);
        t = 0;
        host.querySelectorAll('[data-jump]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
    );
    const SPAN_X = 9; // units of horizontal distance shown
    const SPAN_Y = 6;
    const RUN = 4; // walking speed, units/s
    frameFns.push((dt) => {
      const dpr = fit(canvas);
      const cw = canvas.width;
      const ch = canvas.height;
      const u = Math.min(cw / SPAN_X, ch / SPAN_Y);
      const ox = (cw - SPAN_X * u) / 2;
      const sx = (x: number) => ox + x * u;
      const sy = (y: number) => ch - y * u - 2 * dpr;
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = '#141024';
      g.fillRect(0, 0, cw, ch);
      // height rulers, one per tile
      g.font = `600 ${10 * dpr}px "JetBrains Mono Variable", monospace`;
      for (let y = 1; y < SPAN_Y; y++) {
        g.strokeStyle = 'rgba(255,255,255,0.07)';
        g.beginPath();
        g.moveTo(sx(0), sy(y));
        g.lineTo(sx(SPAN_X), sy(y));
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillText(`${y}`, sx(0) + 3 * dpr, sy(y) - 3 * dpr);
      }
      // a staircase of platforms to aim for
      for (const [x, h] of [[3, 1], [5, 2], [7, 3]] as const) {
        g.fillStyle = tileFill;
        g.fillRect(sx(x), sy(h), 2 * u, h * u);
        g.strokeStyle = tileEdge;
        g.strokeRect(sx(x) + 0.5, sy(h) + 0.5, 2 * u - 1, h * u - 1);
      }
      g.fillStyle = tileFill;
      g.fillRect(sx(0), sy(0) - 0, SPAN_X * u, 2 * dpr);

      const v0 = 25 * force * FIXED_DT; // 5 or 10 units/s
      const apex = (v0 * v0) / (2 * G);
      const tApex = v0 / G;
      // Path: jump at x = 0.5; with force 10 the air jump fires at the apex.
      const path: [number, number][] = [];
      const doubleJump = force === 10;
      const total = doubleJump ? tApex * 2 + tApex : tApex * 2;
      for (let s = 0; s <= total; s += 0.01) {
        let y: number;
        if (!doubleJump || s <= tApex) y = v0 * s - 0.5 * G * s * s;
        else {
          const s2 = s - tApex;
          y = apex + v0 * s2 - 0.5 * G * s2 * s2;
        }
        if (y < 0) break;
        path.push([0.5 + RUN * s, y]);
      }
      g.strokeStyle = lampDeep;
      g.lineWidth = 2.5 * dpr;
      g.setLineDash([6 * dpr, 4 * dpr]);
      g.beginPath();
      path.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
      g.stroke();
      g.setLineDash([]);
      // apex markers
      const peak = doubleJump ? apex * 2 : apex;
      g.fillStyle = lamp;
      g.fillText(tr(`peak ${peak.toFixed(2)} units`, `最高 ${peak.toFixed(2)} 单位`), sx(0.6), sy(Math.min(peak, SPAN_Y - 0.4)) - 6 * dpr);
      if (doubleJump) {
        const [ax, ay] = [0.5 + RUN * tApex, apex];
        g.beginPath();
        g.arc(sx(ax), sy(ay), 4 * dpr, 0, Math.PI * 2);
        g.fill();
        g.fillText(tr('air jump', '空中跳'), sx(ax) + 6 * dpr, sy(ay) + 12 * dpr);
      }
      // the hero riding the arc
      t = still ? 0.42 : (t + dt * 0.6) % 1.3; // with reduced motion the hero rests at the air jump
      const i = Math.min(Math.floor((t / 1) * path.length), path.length - 1);
      const [hx, hy] = path[Math.max(i, 0)] ?? [0.5, 0];
      if (playerImg.complete && playerImg.naturalWidth) {
        g.imageSmoothingEnabled = false;
        g.drawImage(playerImg, sx(hx - 0.4), sy(hy + 0.95), 0.8 * u, 0.95 * u);
      }
      out.innerHTML = tr(
        `Δv = 25 × ${force} × 0.02 = <b>${v0} units/s</b> · one jump peaks at <b>${apex.toFixed(2)}</b> units${doubleJump ? `, with the air jump <b>${(apex * 2).toFixed(2)}</b>` : ''}`,
        `Δv = 25 × ${force} × 0.02 = <b>${v0} 单位/秒</b> · 一跳最高 <b>${apex.toFixed(2)}</b> 单位${doubleJump ? `，加上空中跳可达 <b>${(apex * 2).toFixed(2)}</b>` : ''}`,
      );
    });
  }

  // ---------- 3 · Camera follow on the real Level 1 ----------
  {
    const canvas = host.querySelector<HTMLCanvasElement>('[data-cam]')!;
    const out = host.querySelector<HTMLElement>('[data-cam-out]')!;
    const slider = host.querySelector<HTMLInputElement>('[data-smooth]')!;
    const sliderOut = host.querySelector<HTMLOutputElement>('[data-smooth-out]')!;
    const g = canvas.getContext('2d')!;
    let smooth = 3;
    on(slider, 'input', () => {
      smooth = Number(slider.value);
      sliderOut.value = slider.value;
    });
    type Lvl = { atlas: { name: string }[]; layers: { tiles: [number, number, number][] }[]; camera: { size: number; min: { x: number; y: number }; max: { x: number; y: number } } };
    let level: Lvl | null = null;
    void fetch(LEVEL1)
      .then((r) => r.json())
      .then((d: Lvl) => (level = d))
      .catch(() => {});
    const player = { x: -14, y: -1 };
    const cam = { x: 0, y: 0.19 };
    let pointer: { x: number; y: number } | null = null;
    let auto = 0;
    let acc = 0;
    const bounds = { x0: -21, x1: 22, y0: -7, y1: 17 };
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      return { x: bounds.x0 + fx * (bounds.x1 - bounds.x0), y: bounds.y1 - fy * (bounds.y1 - bounds.y0) };
    };
    on(canvas, 'pointermove', (e) => (pointer = toWorld(e)));
    on(canvas, 'pointerdown', (e) => (pointer = toWorld(e)));
    on(canvas, 'pointerleave', () => (pointer = null));
    frameFns.push((dt) => {
      if (!level) return;
      const dpr = fit(canvas);
      const cw = canvas.width;
      const ch = canvas.height;
      const u = Math.min(cw / (bounds.x1 - bounds.x0), ch / (bounds.y1 - bounds.y0));
      const ox = (cw - (bounds.x1 - bounds.x0) * u) / 2;
      const sx = (x: number) => ox + (x - bounds.x0) * u;
      const sy = (y: number) => ch - (y - bounds.y0) * u;
      // Steer: the pointer, or a lazy loop around the level when idle.
      auto += dt;
      const target = pointer ?? { x: Math.sin(auto * 0.35) * 16, y: 4 + Math.sin(auto * 0.5) * 9 };
      player.x += (target.x - player.x) * Math.min(dt * 6, 1);
      player.y += (target.y - player.y) * Math.min(dt * 6, 1);
      // CameraFollow.Follow at the 0.02 s physics rate.
      const { min, max, size } = level.camera;
      acc += dt;
      while (acc >= FIXED_DT) {
        acc -= FIXED_DT;
        const bx = Math.min(Math.max(player.x, min.x), max.x);
        const by = Math.min(Math.max(player.y, min.y), max.y);
        cam.x += (bx - cam.x) * smooth * FIXED_DT;
        cam.y += (by - cam.y) * smooth * FIXED_DT;
      }

      g.clearRect(0, 0, cw, ch);
      g.fillStyle = '#141024';
      g.fillRect(0, 0, cw, ch);
      for (const layer of level.layers) {
        for (const [x, y, s] of layer.tiles) {
          g.fillStyle = level.atlas[s].name === 'tileset_23' ? lava : tileFill;
          g.fillRect(sx(x), sy(y + 1), Math.ceil(u), Math.ceil(u));
        }
      }
      const halfH = size;
      const halfW = size * (16 / 9);
      // Where the camera's centre may go (dashed), and the view it shows (solid).
      g.strokeStyle = 'rgba(169, 196, 255, 0.6)';
      g.setLineDash([5 * dpr, 4 * dpr]);
      g.lineWidth = 1.5 * dpr;
      g.strokeRect(sx(min.x), sy(max.y), (max.x - min.x) * u, (max.y - min.y) * u);
      g.setLineDash([]);
      g.strokeStyle = lamp;
      g.lineWidth = 2.5 * dpr;
      g.strokeRect(sx(cam.x - halfW), sy(cam.y + halfH), halfW * 2 * u, halfH * 2 * u);
      g.fillStyle = lamp;
      g.beginPath();
      g.arc(sx(cam.x), sy(cam.y), 3 * dpr, 0, Math.PI * 2);
      g.fill();
      // player
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(sx(player.x), sy(player.y), 5 * dpr, 0, Math.PI * 2);
      g.fill();
      const clamped = player.x < min.x || player.x > max.x || player.y < min.y || player.y > max.y;
      const clampNote = clamped ? tr(' · <b>clamped</b>: the camera stops at the level edge', ' · <b>已限位</b>：镜头停在关卡边缘') : '';
      out.innerHTML = `${tr('Lerp factor per step', '每步的插值系数')} = smooth × 0.02 = <b>${(smooth * FIXED_DT).toFixed(2)}</b>${clampNote}`;
    });
  }

  // ---------- 4 · The secret ----------
  {
    let music = 'Harry';
    const consoleEl = host.querySelector<HTMLElement>('[data-console]')!;
    host.querySelectorAll<HTMLButtonElement>('[data-music]').forEach((b) =>
      on(b, 'click', () => {
        music = b.dataset.music!;
        host.querySelectorAll('[data-music]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        consoleEl.textContent = `> LevelManager.chooseMusic = "${music}"`;
      }),
    );
    on(host.querySelector<HTMLElement>('[data-terminal]')!, 'click', () => {
      consoleEl.textContent =
        music === 'Harry'
          ? '> Entering Secret Level!\n> SceneManager.LoadScene("Scenes/LevelS")'
          : "> Secret level inaccessible with Ava's music.";
    });
  }

  // ---------- Timeline ----------
  {
    const box = host.querySelector<HTMLElement>('[data-timeline]')!;
    void fetch(COMMITS)
      .then((r) => r.json())
      .then((commits: { date: string; author: string; merge: boolean; message: string }[]) => {
        if (!box.isConnected) return;
        const lanes = [
          { id: 'FengkaiLiu', label: tr('Fengkai (me)', '丰恺（我）'), color: lamp },
          { id: 'nbalog7', label: 'nbalog7', color: moon },
          { id: 'avafacciolo', label: 'Ava', color: '#ff8fb1' },
        ];
        const t0 = Date.parse('2024-10-24T00:00:00Z');
        const t1 = Date.parse('2024-12-07T00:00:00Z');
        const W = 800;
        const left = 104;
        const laneH = 34;
        const top = 62;
        const H = top + lanes.length * laneH + 34;
        const x = (d: string) => left + ((Date.parse(d) - t0) / (t1 - t0)) * (W - left - 12);
        const milestones: [RegExp, string][] = [
          [/^Initial commit/, tr('Repo + team guide', '仓库 + 协作指南')],
          [/horizontal movement/, tr('Movement', '移动')],
          [/camera follow/, tr('Camera', '镜头')],
          [/^implemented double jumping/, tr('Double jump', '二段跳')],
          [/^die when touch lava/, tr('Lava', '岩浆')],
          [/^Implemented wall jumps/, tr('Wall jumps', '蹬墙跳')],
          [/^Add 2 sound system/, tr('Two soundtracks', '双配乐')],
          [/^level3 & level secret/, tr('Secret level', '隐藏关卡')],
          [/^FINAL UPDATE/, tr('Final build', '最终版本')],
        ];
        // Label rows: each remembers where its last label ended, so labels never overlap.
        const rowEnds = [-999, -999, -999, -999];
        // Clips made minutes apart share an x; nudge each past the previous one in its lane.
        const laneLastX = lanes.map(() => -999);
        const flags: string[] = [];
        const clips: string[] = [];
        commits.forEach((c, i) => {
          const lane = Math.max(lanes.findIndex((l) => l.id === c.author), 0);
          const cx = Math.max(x(c.date), laneLastX[lane] + 9);
          laneLastX[lane] = cx;
          const cy = top + lane * laneH;
          const color = lanes[lane].color;
          const label = `${new Date(c.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} · ${lanes[lane].label}: ${c.message}`;
          const shape = c.merge
            ? `<rect x="${cx - 5}" y="${cy + laneH / 2 - 5}" width="10" height="10" transform="rotate(45 ${cx} ${cy + laneH / 2})" />`
            : `<rect x="${cx - 4}" y="${cy + 6}" width="8" height="${laneH - 12}" rx="3" />`;
          clips.push(`<g class="tl__clip" tabindex="0" data-i="${i}" fill="${color}" aria-label="${esc(label)}"><title>${esc(label)}</title>${shape}</g>`);
          const m = milestones.find(([re]) => re.test(c.message));
          if (m) {
            const width = labelWidth(m[1]) + 8;
            let row = rowEnds.findIndex((end) => cx > end);
            if (row < 0) row = rowEnds.length - 1;
            rowEnds[row] = cx + width;
            const fy = 12 + row * 12;
            flags.push(`<line x1="${cx}" x2="${cx}" y1="${fy + 3}" y2="${top + lanes.length * laneH}" class="tl__flagline" /><text x="${cx + 3}" y="${fy}" class="tl__flag">${esc(m[1])}</text>`);
          }
        });
        const weeks: string[] = [];
        for (let t = t0 + 24 * 3600e3; t < t1; t += 7 * 24 * 3600e3) {
          const d = new Date(t).toISOString();
          weeks.push(`<line x1="${x(d)}" x2="${x(d)}" y1="${top}" y2="${top + lanes.length * laneH}" class="tl__grid" /><text x="${x(d)}" y="${H - 12}" class="tl__date">${new Date(t).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</text>`);
        }
        const mine = commits.filter((c) => c.author === 'FengkaiLiu').length;
        box.innerHTML = `
          <div class="tl__scroll">
            <svg class="tl" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr('Commit timeline, October to December 2024', '提交时间线，2024 年 10 月至 12 月')}">
              ${lanes.map((l, i) => `<rect x="0" y="${top + i * laneH}" width="${W}" height="${laneH}" class="tl__lane${i === 0 ? ' tl__lane--me' : ''}" /><text x="8" y="${top + i * laneH + laneH / 2 + 4}" class="tl__name">${esc(l.label)}</text>`).join('')}
              ${weeks.join('')}
              ${flags.join('')}
              ${clips.join('')}
            </svg>
          </div>
          <p class="deep__readout" data-tl-out>${tr(`${commits.length} commits · ${mine} mine`, `${commits.length} 次提交 · 其中 ${mine} 次是我的`)}</p>
        `;
        const readout = box.querySelector<HTMLElement>('[data-tl-out]')!;
        const show = (e: Event) => {
          const g = (e.target as Element).closest<SVGGElement>('.tl__clip');
          if (g) readout.textContent = g.getAttribute('aria-label');
        };
        box.addEventListener('pointerover', show);
        box.addEventListener('focusin', show);
      })
      .catch(() => {
        box.innerHTML = `<p class="deep__readout">${tr('The history snapshot did not load.', '提交历史没能加载。')}</p>`;
      });
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      for (const c of cleanups) c();
      host.innerHTML = '';
    },
  };
}
