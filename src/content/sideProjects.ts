// Bonus tracks: the smaller projects. They share one chapter (A7, after my_KWS) and one
// page, where each is a row that opens in place, lighter than a project's liner notes.
// Text a visitor reads comes in both languages, as tr('English', '中文'); names stay as they are.
import { tr } from '../i18n';

export interface SideProject {
  id: string;
  title: string;
  /** The tool or medium, shown beside the title: "FL Studio", "Max/MSP". */
  kind: string;
  year?: string;
  /** The class it was made for, if any. */
  course?: string;
  /** One line, shown while the row is closed. */
  blurb: string;
  text?: string;
  bullets?: string[];
  tags?: string[];
  /** Songs that play on the room's turntable, so the speakers and the scope hear them too.
   *  `markers` are the song's sections (seconds); each one jumps there. */
  audio?: { title: string; src: string; markers?: { label: string; at: number }[] }[];
  /** `slot` holds a picture's place until the file arrives (alt is its note). */
  media?: { type: 'video' | 'image' | 'slot'; src?: string; alt: string }[];
  links?: { label: string; href: string }[];
  /** Still waiting on content from Fengkai: the row says so instead of a write-up. */
  placeholder?: boolean;
}

export const sideProjects: SideProject[] = [
  {
    id: 'fl-studio',
    title: tr('Kawaii bass final', 'Kawaii Bass 期末作品'),
    kind: 'FL Studio',
    year: '2025',
    course: 'Composing w/ Digital Tech',
    blurb: tr('A two-and-a-half-minute kawaii bass track: two drops, Serum synths and a lot of tiny sound effects.', '一首两分半的 Kawaii Bass：两段 drop，Serum 音色，还有一大堆小音效。'),
    text: tr(
      'My final for Composing w/ Digital Tech, made in FL Studio. The song runs in three sections, A, B and C, each building to a drop. The drums are mostly from KSHMR sample packs, and the genre invites a lot of playful sound effects: a squeaky bed spring, water drops, anime voice chirps, a cheering crowd. Vinyl crackle and Costa Rican birds and crickets run under the whole song as a lo-fi bed.',
      '《Composing w/ Digital Tech》课的期末作品，用 FL Studio 制作。整首歌分成 A、B、C 三段，每段都推向一个 drop。鼓大多来自 KSHMR 的采样包，这个曲风也很适合加各种俏皮的音效：吱呀的床垫弹簧、水滴、动漫少女的语音、观众的欢呼。黑胶噪音和哥斯达黎加的鸟鸣虫叫铺在整首歌底下，作为 lo-fi 的底层氛围。',
    ),
    bullets: tr(
      [
        'Layered drop chords in Serum: a bright sawtooth layer for weight and a softer Basic Mini layer to balance it, with a low-pass sweep that keeps the sustain smooth.',
        'A harder lead for the build from A into B: two sawtooth oscillators plus noise, its filter stopping at the mids so the edge stays.',
        'Side-chain-style pumping made with volume automation (two Balance plugins) across the builds and drops.',
        'Section B stretches an old tube TV sound by crossfading copies of it, and the build to C ducks the mix so the guitar comes through.',
        'On the master, only an EQ and a limiter.',
      ],
      [
        '在 Serum 里叠加的 drop 和弦：明亮的锯齿波层负责力量感，柔和的 Basic Mini 层负责平衡，再用低通滤波扫频让延音保持顺滑。',
        'A 段进入 B 段的 build 用了一条更硬的 lead：两个锯齿波振荡器加噪声，滤波只扫到中频，保留一点锋利。',
        '用音量自动化（两个 Balance 插件）做出类似侧链的律动，主要用在 build 和 drop 段。',
        'B 段把一段老电视机的声音复制后交叉淡化来拉长；推向 C 段的 build 会压低整体音量，让吉他透出来。',
        '总线上只挂了一个 EQ 和一个限制器。',
      ],
    ),
    tags: ['FL Studio', 'Serum', 'Kawaii bass', tr('Sound design', '声音设计')],
    audio: [
      {
        title: tr('Kawaii bass final', 'Kawaii Bass 期末作品'),
        src: '/bonus/fl-final.mp3',
        markers: [
          { label: tr('Intro', '前奏'), at: 0 },
          { label: tr('Build', 'Build'), at: 12 },
          { label: tr('Drop', 'Drop'), at: 47 },
          { label: tr('Section B', 'B 段'), at: 73 },
          { label: tr('Build to C', '推向 C 段'), at: 98 },
          { label: tr('Drop', 'Drop'), at: 120 },
          { label: tr('Outro', '尾声'), at: 132 },
        ],
      },
    ],
    media: [
      {
        type: 'image',
        src: '/bonus/fl-final-playlist.webp',
        alt: tr(
          'The FL Studio playlist around the drop: chords, leads and bass on top, then layers of drum loops, crowd and sweep effects, with vinyl crackle and birdsong running along the bottom.',
          'FL Studio 编曲窗口里 drop 附近的一段：上面是和弦、lead 和贝斯，下面是层层叠叠的鼓循环、人群和扫频音效，最底下是一直铺着的黑胶噪音和鸟鸣。',
        ),
      },
    ],
    links: [{ label: tr('Production notes (PDF, 8 pages)', '制作文档（PDF，8 页）'), href: '/bonus/fl-final-notes.pdf' }],
  },
  {
    id: 'max-final',
    title: '2D Music Starship',
    kind: 'Max/MSP',
    year: '2025',
    blurb: tr('A little starship game built entirely in Max, where flying the ship plays the music.', '一个完全在 Max 里做的小飞船游戏，开飞船就是在演奏。'),
    text: tr(
      'A final project that asks what else a music tool can do. Everything runs inside Max: Jitter draws the game, MSP makes the sound, and JavaScript inside the patch handles the gameplay. Fly with W, A, S and D, hold the mouse to fire, and every move plays a note, so a run through space doubles as a short piece of music.',
      '一个期末项目，想看看音乐软件还能拿来做什么。所有东西都跑在 Max 里：Jitter 负责画面，MSP 负责声音，patch 里的 JavaScript 负责游戏逻辑。用 W、A、S、D 驾驶飞船，按住鼠标开火，每个动作都会发出一个音，所以在太空里飞一圈，也就是弹了一小段曲子。',
    ),
    bullets: tr(
      [
        'Each direction is a note of a C major chord: W plays C5, A plays E4, S plays C4 and D plays G4. Letting go of the key silences it.',
        'Firing adds a D5 on a second oscillator, so shooting colors the chord. Notes go through mtof into cycle~ sine oscillators and out of ezdac~.',
        'The graphics are a jit.world with sprites (the ship, its shots and a full-screen background) drawn as jit.gl.videoplane objects.',
        'Gameplay lives in JavaScript classes inside the patch: a reusable Sprite, the Starship with its movement and a steady rate of fire, and the projectiles that fly up and clean themselves up off screen.',
        'Written up as a short paper, "Real-Time Audiovisual Interaction with Max/MSP Jitter".',
      ],
      [
        '每个方向对应 C 大三和弦里的一个音：W 是 C5，A 是 E4，S 是 C4，D 是 G4。松开按键，声音就停。',
        '开火会在第二个振荡器上加一个 D5，所以射击会给和弦加一点色彩。音符经过 mtof 进入 cycle~ 正弦振荡器，再从 ezdac~ 输出。',
        '画面是一个 jit.world，飞船、子弹和全屏背景都是用 jit.gl.videoplane 画出来的精灵。',
        '游戏逻辑写在 patch 里的 JavaScript 类中：一个可复用的 Sprite，负责移动和固定射速的 Starship，以及向上飞、飞出屏幕后自己清理掉的子弹。',
        '最后写成了一篇短论文：《Real-Time Audiovisual Interaction with Max/MSP Jitter》。',
      ],
    ),
    tags: ['Max/MSP', 'Jitter', 'JavaScript', tr('Interactive audio', '交互音频')],
    media: [
      { type: 'image', src: '/bonus/max-starship-game.webp', alt: tr('The game window: the starship over a pink and violet galaxy.', '游戏窗口：飞船悬在粉紫色的星系前。') },
      {
        type: 'image',
        src: '/bonus/max-starship-patch.webp',
        alt: tr('Inside: the Starship JavaScript next to the Max patch, where key presses become the notes 72, 64, 60 and 67.', '内部结构：左边是 Starship 的 JavaScript，右边是 Max patch，按键在这里变成 72、64、60、67 这几个音。'),
      },
    ],
    links: [{ label: tr('Read the paper (PDF, 2 pages)', '阅读论文（PDF，2 页）'), href: '/bonus/max-starship-paper.pdf' }],
  },
];
