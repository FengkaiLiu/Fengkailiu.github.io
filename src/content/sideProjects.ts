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
  /** A sound board: one row per family of sounds, one column per level (`sounds` lines up
   *  with `levels`; null leaves a gap), plus an optional longer sample at the row's end. */
  board?: { caption: string; levels: string[]; sets: { name: string; note?: string; sounds: (string | null)[]; sample?: string }[] };
  /** An interactive walkthrough mounted inside the row, loaded only when it opens (src/ui/dspLab.ts). */
  deepDive?: 'dsp';
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
  {
    id: 'alerts',
    title: tr('Gentler alert sounds', '更温和的提示音'),
    kind: tr('Sound design', '声音设计'),
    year: '2025',
    course: 'Sonification Lab @ Northeastern University',
    blurb: tr('Four families of alert sounds for a glucose monitor: as hard to miss as an alarm, without the alarm.', '为血糖仪设计的四组提示音：像警报一样不会错过，却不像警报那样刺耳。'),
    text: tr(
      'The Dexcom G7 glucose monitor sends a reading every five minutes, and when glucose goes out of range the phone app sounds an alert. Those alerts are loud and jarring, and they go off just when a low can leave someone anxious and irritable. The lab\'s idea: someone who wears the monitor around the clock can learn any sound, so an alert doesn\'t have to sound like an alarm. It only has to be impossible to miss. I designed four families of alerts, each with three levels of urgency, shaped by research on what makes a sound stand out.',
      'Dexcom G7 血糖仪每五分钟发送一次读数，血糖超出范围时，手机应用会响起提示音。这些提示音又响又刺耳，而且偏偏在低血糖让人焦虑、烦躁的时候响起。实验室的想法是：一直戴着血糖仪的人可以学会任何声音，所以提示音不必听起来像警报，只要不会被忽略就行。我设计了四组提示音，每组三个紧急程度，设计依据是关于「什么样的声音最容易被注意到」的研究。',
    ),
    bullets: tr(
      [
        'Built on a review of 14 papers on auditory warnings: keep alerts in the 500 to 2,500 Hz band where hearing is most sensitive, use smooth envelopes so they don\'t startle, and carry urgency mostly in timing (speed and repetition) rather than pitch alone.',
        'Each family shares one timbre, so the set is recognizable as a set, while every level stays distinct within it.',
        'Melodies that match their meaning. In the Frutiger Aero set, Confirm is a major third up (E5 to G5), Caution rises and settles (F5, A5, G5), and Warning climbs (E5, F♯5, A5).',
        'Frutiger Aero is FM synthesis in Serum: a sine carrier with a sine modulator two to three octaves up, a 15 ms attack and 600 ms decay, a slow 0.3 Hz pitch drift for shimmer, then a 1.8 kHz EQ boost, plate reverb and light compression.',
        'The other three families carry the same rules into other moods: lo-fi, dreamcore and 24/7 Synth.',
      ],
      [
        '基于对 14 篇听觉警报相关论文的整理：提示音放在人耳最敏感的 500 到 2,500 Hz 频段，用平滑的包络避免吓人一跳，紧急程度主要靠节奏（速度和重复）来表达，而不只靠音高。',
        '每组提示音共用一种音色，听得出是同一套；同一组里的每个等级又各不相同。',
        '旋律和含义对得上。在 Frutiger Aero 这组里，Confirm 是上行大三度（E5 到 G5），Caution 先升后落（F5、A5、G5），Warning 一路上行（E5、F♯5、A5）。',
        'Frutiger Aero 用 Serum 做 FM 合成：正弦波载波，加一个高两到三个八度的正弦波调制器，15 毫秒起音、600 毫秒衰减，0.3 Hz 的缓慢音高漂移带来微光感，再加 1.8 kHz 的 EQ 提升、板式混响和轻度压缩。',
        '另外三组把同样的原则带进了不同的氛围：lo-fi、dreamcore 和 24/7 Synth。',
      ],
    ),
    tags: [tr('Psychoacoustics', '心理声学'), 'Serum', tr('FM synthesis', 'FM 合成'), 'FL Studio'],
    board: {
      caption: tr('Every alert, from the calmest level to the most urgent. Each plays on the room\'s turntable.', '每一个提示音，从最平静到最紧急。点一下就会在房间的唱机上播放。'),
      levels: [tr('Info', '提示'), tr('Caution', '注意'), tr('Warning', '警告')],
      sets: [
        { name: 'Frutiger Aero', sounds: ['/bonus/alerts/aero-info.mp3', '/bonus/alerts/aero-caution.mp3', '/bonus/alerts/aero-warning.mp3'], sample: '/bonus/alerts/aero-sample.mp3' },
        { name: 'Lo-fi', sounds: ['/bonus/alerts/lofi-info.mp3', '/bonus/alerts/lofi-caution.mp3', '/bonus/alerts/lofi-warning.mp3'], sample: '/bonus/alerts/lofi-sample.mp3' },
        { name: 'Dreamcore', sounds: ['/bonus/alerts/dream-info.mp3', '/bonus/alerts/dream-caution.mp3', '/bonus/alerts/dream-warning.mp3'], sample: '/bonus/alerts/dream-sample.mp3' },
        { name: '24/7 Synth', sounds: ['/bonus/alerts/synth-info.mp3', '/bonus/alerts/synth-caution.mp3', '/bonus/alerts/synth-warning.mp3'], sample: '/bonus/alerts/synth-sample.mp3' },
      ],
    },
    media: [
      {
        type: 'image',
        src: '/bonus/alerts/aero-serum.webp',
        alt: tr('The Frutiger Aero patch in Serum 2 inside FL Studio: a sine carrier, an FM modulator two octaves up, and the short decay envelope.', 'FL Studio 里 Serum 2 中的 Frutiger Aero 音色：正弦波载波、高两个八度的 FM 调制器，以及短衰减包络。'),
      },
    ],
  },
  {
    id: 'dsp',
    title: tr('dsp.h: a DSP library in C', 'dsp.h：用 C 写的 DSP 库'),
    kind: 'C · DSP',
    year: '2025',
    course: 'Digital Signal Processing and Analysis @ Northeastern University',
    blurb: tr('One header file, written project by project over a semester: levels, fades, oscillators, modulation, a flanger, FIR and IIR filters.', '一个头文件，一个项目接一个项目，写了一整个学期：电平、淡变、振荡器、调制、镶边，还有 FIR 和 IIR 滤波器。'),
    text: tr(
      'The course had one rule: every project goes into a single file, dsp.h, in plain C with no dependencies (two late routines borrow JUCE for its FFT). Pick a routine below. At the top are its core lines, exactly as they are in dsp.h; under them, the same math ported line for line to JavaScript and drawn live. Listen runs it on a short sound and plays the result through the room.',
      '这门课只有一条规矩：每个项目都写进同一个文件 dsp.h，用纯 C，不依赖任何库（后期有两个函数借用了 JUCE 的 FFT）。在下面选一个函数：上面是它的核心代码，和 dsp.h 里一字不差；下面是把同样的数学逐行移植到 JavaScript 后实时画出来的图。点「试听」会用一小段声音跑一遍，再通过房间播放出来。',
    ),
    tags: ['C', 'DSP', tr('Synthesis', '合成'), tr('Filters', '滤波器'), 'JUCE'],
    deepDive: 'dsp',
  },
];
