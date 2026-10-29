// Project data. Each entry becomes one pinned scroll chapter (Floor 10).
// Migrated from legacy/index.html. `placeholder: true` marks entries still waiting on content.
// Text a visitor reads comes in both languages, as tr('English', '中文'); names stay as they are.
import { tr } from '../i18n';

export interface ProjectSection {
  heading: string;
  text?: string;
  bullets?: string[];
}

/** A captioned group of media in the liner notes: videos play muted on loop, photos enlarge. */
export interface MediaGroup {
  caption: string;
  items: { type: 'video' | 'image'; src: string; alt: string }[];
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  cover: string;
  sections: ProjectSection[];
  links: { demo?: string; github?: string; /** Button text for the demo link (default "Live demo"). */ demoLabel?: string };
  media?: MediaGroup[];
  /** A live demo to embed in the liner notes, loaded only when the visitor asks. */
  embed?: { title: string; src: string; allow?: string; note: string };
  /** A game playable on the console overlay (Hot Footer). */
  game?: 'lava-rising';
  /** An interactive code walkthrough in the liner notes (Hot Footer). */
  deepDive?: 'lava-rising';
  /** 3D models for the liner notes' model viewer (Sonare's boats). */
  models?: { caption: string; items: { name: string; src: string; color: string }[] };
  /** Assets the scroll chapter still needs from Fengkai. */
  needs?: string[];
  placeholder?: boolean;
}

export const projects: Project[] = [
  {
    id: 'vrmusicroom',
    title: 'VR Music Room',
    subtitle: tr('A virtual reality room that visualizes Spotify music with light effects.', '一个用灯光特效把 Spotify 音乐可视化的 VR 房间。'),
    tags: ['Unity', 'CS/XR', tr('Music', '音乐'), 'C#'],
    cover: '/PWpage/vrmusicroom.jpg',
    sections: [
      { heading: tr('The problem', '问题'), text: tr('For my co-op project, I needed to develop an immersive VR application that could connect multiple APIs into one unified experience, something I had never done before.', '我的 Co-op 实习项目要求开发一个沉浸式 VR 应用，把多个 API 串成一个统一的体验，这是我之前从没做过的。') },
      { heading: tr('The solution', '方案'), text: tr('After researching both AR and VR approaches, I chose VR for its greater creative control and immersive potential. I built a virtual room that reacts to music in real time, syncing lighting and visual effects to whatever song is playing on Spotify.', '对比调研了 AR 和 VR 两条路线后，我选择了 VR，因为它的创作自由度和沉浸感更强。我做了一个实时响应音乐的虚拟房间，灯光和视觉效果会跟着 Spotify 上正在播放的歌同步变化。') },
      { heading: tr('Key features', '主要功能'), bullets: tr(['Integrated Spotify, Last.fm, and Gemini APIs for AI-driven music analysis and real-time synchronization.', 'Dynamic lighting that responds uniquely to every song.'], ['整合 Spotify、Last.fm 和 Gemini API，用 AI 分析音乐并实时同步。', '动态灯光，每首歌都有自己独特的响应。']) },
      { heading: tr('What I learned', '收获'), text: tr('How to architect communication between multiple services and keep performance smooth while handling real-time data streams from different APIs.', '学会了如何设计多个服务之间的通信架构，并在同时处理多个 API 的实时数据流时保持流畅的性能。') },
    ],
    links: { github: 'https://github.com/FengkaiLiu/XR-Coop-Project' },
    media: [
      {
        caption: tr('Dev stage video recording', '开发阶段录屏'),
        items: [
          { type: 'video', src: '/vrmusicroom/demo.mp4', alt: tr('VR Music Room, dev stage recording, part 1', 'VR Music Room 开发阶段录屏（一）') },
          { type: 'video', src: '/vrmusicroom/demo2.mp4', alt: tr('VR Music Room, dev stage recording, part 2', 'VR Music Room 开发阶段录屏（二）') },
        ],
      },
      {
        caption: tr('Co-op project presentation', 'Co-op 项目展示'),
        items: [
          { type: 'image', src: '/vrmusicroom/shot-1.jpg', alt: tr('Fengkai in the headset, the room mirrored on the monitor', '丰恺戴着头显，显示器上同步显示 VR 房间') },
          { type: 'image', src: '/vrmusicroom/shot-2.jpg', alt: tr('The in-VR song picker shown on the monitor', '显示器上的 VR 内选歌界面') },
          { type: 'image', src: '/vrmusicroom/shot-3.jpg', alt: tr('Presenting the VR room in the lab', '在实验室展示 VR 房间') },
        ],
      },
    ],
  },
  {
    id: 'sonare',
    title: 'Sonare of the Lake',
    subtitle: tr('A lyric visualizer built for the Hatsune Miku "Magical Mirai 2026" Programming Contest.', '为初音未来「魔法未来 2026」编程大赛制作的歌词可视化作品。'),
    tags: ['Three.js', 'TextAlive API', 'Web/JS', 'Blender'],
    cover: '/PWpage/Sonare.jpg',
    sections: [
      { heading: tr('The concept', '创意'), text: tr('The player sails a Vocaloid-themed boat across a stylized lake. Lyrics emerge from the water as schools of luminous particles during verses, then coalesce in the sky during choruses, turning song structure into navigable geography.', '玩家驾驶一艘 Vocaloid 主题的小船航行在风格化的湖面上。主歌时，歌词化作成群的发光粒子从水中浮现；副歌时，它们汇聚到天空中。歌曲的结构由此变成了一片可以航行的地形。') },
      { heading: tr("How it's built", '技术实现'), text: tr('A Vite + Three.js (r172) web app driven by the TextAlive App API for lyric, beat, and chord timing. Cannon-es powers buoyancy and boat physics, Troika Three Text renders SDF lyric glyphs, GSAP drives the cinematic camera, and Draco compresses the terrain mesh. All six character boats (Miku, Rin, Len, Luka, KAITO, MEIKO) were hand-modeled in Blender from an original cube-chibi template.', '基于 Vite + Three.js (r172) 的网页应用，由 TextAlive App API 提供歌词、节拍和和弦的时间信息。Cannon-es 负责浮力和船体物理，Troika Three Text 渲染 SDF 歌词字形，GSAP 驱动电影感镜头，Draco 压缩地形网格。六艘角色船（Miku、Rin、Len、Luka、KAITO、MEIKO）都是在 Blender 里基于一个原创的方块 Q 版模板手工建模的。') },
      { heading: tr('Key features', '主要功能'), bullets: tr([
        'Six playable Vocaloid boats and six song-selection portals arranged around the lake.',
        'WASD / arrow-key navigation with physics-based buoyancy and cinematic dive, chase, and sky camera modes.',
        'Particle-based lyric visualization synced to verse and chorus structure via TextAlive.',
        'Floating note pickups, wooden-plank obstacles, first-time control hints, and an end-of-song return circle.',
        'Japanese / English UI toggle and locally subsetted Kiwi Maru + Caveat fonts.',
      ], [
        '六艘可操控的 Vocaloid 小船，湖边环绕着六个选歌传送门。',
        'WASD / 方向键操控，基于物理的浮力，以及俯冲、追随、天空三种电影感镜头模式。',
        '通过 TextAlive 与主歌、副歌结构同步的粒子歌词可视化。',
        '漂浮的音符道具、木板障碍、首次游玩的操作提示，以及歌曲结束时的返回光圈。',
        '日文 / 英文界面切换，Kiwi Maru 和 Caveat 字体按需本地子集化。',
      ]) },
      { heading: tr('Credits', '制作人员'), text: tr('Team FBH: Fengkai Liu (lead development, 3D modeling, visual design, QA), Brian Liu (creative direction, coding, QA), and Haolin Wang (original cube-chibi Miku base mesh, used with permission). Per contest guidelines, no generative AI was used for any music, image, illustration, or text in the output.', 'FBH 团队：刘丰恺（主程、3D 建模、视觉设计、测试），Brian Liu（创意指导、编程、测试），Haolin Wang（原创方块 Q 版 Miku 基础模型，经授权使用）。按照大赛规定，作品中的音乐、图像、插画和文字均未使用生成式 AI。') },
    ],
    links: {
      demo: 'https://magical-mirai-2026-sonare-of-the-la.vercel.app/',
      github: 'https://github.com/FengkaiLiu/magical-mirai-2026-sonare-of-the-lake',
    },
    media: [
      {
        caption: tr('Gameplay demo', '游戏演示'),
        items: [{ type: 'video', src: '/sonareofthelake/mikuboat.mp4', alt: tr('Sonare of the Lake gameplay recording', 'Sonare of the Lake 游戏录屏') }],
      },
      {
        caption: tr('In-game screenshots', '游戏截图'),
        items: [
          { type: 'image', src: '/sonareofthelake/sonare-1.jpg', alt: tr('Verse lyrics rising from the lake beside the boat', '主歌歌词从小船旁的湖面升起') },
          { type: 'image', src: '/sonareofthelake/sonare-2.jpg', alt: tr('Chorus lyrics written across the sky above the mountains', '副歌歌词铺满群山上方的天空') },
        ],
      },
    ],
    models: {
      caption: tr('The six boats, hand-modeled in Blender', '六艘小船，在 Blender 中手工建模'),
      items: [
        { name: 'Miku', src: '/sonareofthelake/littleshipmiku.glb', color: '#39c5bb' },
        { name: 'Rin', src: '/sonareofthelake/littleshipRin.glb', color: '#ffcf33' },
        { name: 'Len', src: '/sonareofthelake/littleshipLen.glb', color: '#f5b400' },
        { name: 'Luka', src: '/sonareofthelake/littleshipluka.glb', color: '#ff8fb1' },
        { name: 'KAITO', src: '/sonareofthelake/littleshipKAITO.glb', color: '#4a6cff' },
        { name: 'MEIKO', src: '/sonareofthelake/littleshipMEIKO.glb', color: '#d8263c' },
      ],
    },
  },
  {
    id: 'roomlink',
    title: 'RoomLink-ChillZone',
    subtitle: tr('A self-designed VRChat world built from scratch with Unity and the VRChat SDK.', '用 Unity 和 VRChat SDK 从零搭建、独立设计的 VRChat 世界。'),
    tags: ['Unity', tr('Game Design', '游戏设计'), 'VRChat'],
    cover: '/PWpage/vrchatroom.jpg',
    sections: [
      { heading: tr('The problem', '问题'), text: tr('This was my first virtual world, so I had to learn the entire pipeline from 3D environment design to SDK integration, essentially from zero.', '这是我做的第一个虚拟世界，从 3D 场景设计到 SDK 集成，整条流程基本都要从零学起。') },
      { heading: tr('The solution', '方案'), text: tr('I learned the VRChat SDK inside Unity along with ProBuilder, Bakery, and Magic Light Probes. I integrated interactive prefabs to build a rich environment, then optimized the map from 300MB down to 50MB so it runs smoothly on standalone VR headsets.', '我在 Unity 里学习了 VRChat SDK，以及 ProBuilder、Bakery 和 Magic Light Probes。我整合了可交互的预制体来丰富场景，再把地图从 300MB 优化到 50MB，让它能在一体机 VR 头显上流畅运行。') },
      { heading: tr('Key features', '主要功能'), bullets: tr(['Over 1,000 interactable furniture pieces with VRChat grab functionality.', 'Built-in entertainment including a pool table, arcade machines, and more.'], ['超过 1,000 件可交互家具，支持 VRChat 的抓取功能。', '内置台球桌、街机等娱乐设施。']) },
      { heading: tr('What I learned', '收获'), text: tr('How to combine Unity with third-party SDKs, prefabs, and plugins to build fully interactive worlds, and why aggressive optimization matters for mobile VR.', '学会了把 Unity 与第三方 SDK、预制体和插件结合起来，搭建完整可交互的世界，也明白了为什么移动 VR 必须做极致的优化。') },
    ],
    links: {
      demo: 'https://vrchat.com/home/launch?worldId=wrld_1c519374-adfc-4072-9df4-21458d94a13e',
      demoLabel: tr('Visit in VRChat', '在 VRChat 中访问'),
      github: 'https://github.com/FengkaiLiu/VRchatRoomLowpoly',
    },
    media: [
      {
        caption: tr('World intro', '世界介绍'),
        items: [{ type: 'video', src: '/vrchatroom/vrchatroom.mp4', alt: tr('RoomLink-ChillZone world intro video', 'RoomLink-ChillZone 世界介绍视频') }],
      },
    ],
  },
  {
    id: 'hotfooter',
    title: 'Hot Footer',
    subtitle: tr('A 2D cave platformer from a class project: climb to the exit before you touch the lava. Playable right here.', '一个课程项目里的 2D 洞穴平台跳跃游戏：在碰到岩浆之前爬到出口。可以直接在这里玩。'),
    tags: ['Unity', 'C#', tr('Game Programming', '游戏编程'), tr('Sound', '声音')],
    cover: '/PWpage/hotfooter.jpg',
    game: 'lava-rising',
    deepDive: 'lava-rising',
    sections: [
      { heading: tr('The game', '游戏'), text: tr('Climb out of a cave without touching the lava. Three levels of tight platforming with double jumps and wall jumps, a run timer, and an altimeter that fills as you climb. Near the top of Level 3 the music lifts and the altimeter starts to blink. A terminal hidden in Level 2 opens a secret level.', '在不碰到岩浆的前提下爬出洞穴。三个关卡，操作紧凑，有二段跳和蹬墙跳，还有计时器和随攀爬升高的高度计。快到第 3 关顶部时，音乐会扬起，高度计开始闪烁。第 2 关藏着一台终端，能打开隐藏关卡。') },
      { heading: tr('What I built', '我负责的部分'), bullets: tr([
        'The core player controller: horizontal movement, running on Shift, the raycast ground check, jumping, and the 2D friction fix.',
        'Idle, walk and run animations blended by speed in the Animator, plus jump and fall states.',
        'A smoothed camera that follows the player and stays inside each level\'s bounds.',
        'The jump tuning: I halved the jump force (20 to 10) so the platforms need the double jump.',
        'The sound system: a soundtrack choice on the title screen that changes the music in every level after it.',
        'Level 2, Level 3 and the secret level (it only opens with my soundtrack), the doors between levels, and the win condition.',
        'The team setup: I created the repo and wrote the Git and Unity workflow guide my teammates followed.',
      ], [
        '核心角色控制器：水平移动、按 Shift 奔跑、射线地面检测、跳跃，以及 2D 摩擦力问题的修复。',
        '在 Animator 里按速度混合的待机、行走和奔跑动画，以及跳跃和下落状态。',
        '平滑跟随玩家、并始终限制在关卡边界内的镜头。',
        '跳跃手感调校：我把跳跃力减半（20 改成 10），让平台必须用二段跳才能过去。',
        '声音系统：在标题画面选择配乐，之后每一关的音乐都会随之改变。',
        '第 2 关、第 3 关和隐藏关卡（只有选我的配乐才能进入），关卡之间的门，以及通关条件。',
        '团队搭建：我创建了代码仓库，并写了队友们遵循的 Git 与 Unity 协作指南。',
      ]) },
      { heading: tr('The team', '团队'), text: tr('Three of us built it in about six weeks (October to December 2024), working through GitHub and Discord. I made 25 of the project\'s 39 commits. My teammates added the double jump and wall jumps (nbalog7) and the lava, start, win and lose screens (Ava).', '我们三个人用了大约六周（2024 年 10 月到 12 月）完成，通过 GitHub 和 Discord 协作。项目一共 39 次提交，其中 25 次是我的。队友们负责了二段跳和蹬墙跳（nbalog7），以及岩浆、开始、胜利和失败画面（Ava）。') },
      { heading: tr('This browser version', '这个网页版'), text: tr('The game on this page is a port I made from the original Unity project. The levels are read straight from the Unity scene files, and the movement uses the same numbers as the C# code: 4 units per second walking, twice that running, one air jump, and wall jumps whenever the head and feet both touch a wall.', '这个页面上的游戏是我从原版 Unity 项目移植过来的。关卡直接读取自 Unity 场景文件，移动参数也和 C# 代码完全一致：行走每秒 4 个单位，奔跑翻倍，一次空中跳跃，头和脚同时贴墙时可以蹬墙跳。') },
      { heading: tr('Credits', '制作人员'), text: tr('Soundtrack (title theme, level music, secret level, victory and defeat) by Fengkai Liu, produced with Suno. The original title-screen music is by teammate Ava. Art: the Super Grotto Escape pack by Ansimuz (CC0).', '配乐（标题曲、关卡音乐、隐藏关卡、胜利和失败音乐）由刘丰恺用 Suno 制作。原版标题画面音乐由队友 Ava 制作。美术素材：Ansimuz 的 Super Grotto Escape 素材包（CC0）。') },
      { heading: tr('What I learned', '收获'), text: tr('How to collaborate through version control, and how to pick up and apply new tools quickly under a tight deadline.', '学会了通过版本控制协作，以及如何在紧张的期限内快速上手并用好新工具。') },
    ],
    links: { github: 'https://github.com/GameDevGroup4/Unity-Project' },
    media: [
      {
        caption: tr('From the original Unity build', '来自原版 Unity 构建'),
        items: [
          { type: 'image', src: '/hotfooter/shot-1.jpg', alt: tr('Hotfooter title screen with Start and the Harry, Ava and Mute soundtrack buttons', 'Hotfooter 标题画面，有开始按钮和 Harry、Ava、静音三个配乐按钮') },
          { type: 'image', src: '/hotfooter/shot-2.jpg', alt: tr('A whole level in the Unity editor: stone platforms and a rope bridge above lava pools, with the camera frame drawn in white', 'Unity 编辑器中的完整关卡：岩浆池上方的石台和绳桥，白框是镜头范围') },
          { type: 'image', src: '/hotfooter/shot-3.jpg', alt: tr('The yellow hero standing on a stone ledge just above the lava', '黄色小人站在岩浆正上方的石台边缘') },
        ],
      },
    ],
  },
  {
    id: 'project5',
    title: 'my_KWS',
    subtitle: tr('Edge keyword spotting from scratch: a "Hey Siri"-style wake-word detector that runs in your browser.', '从零实现的端侧关键词识别：一个像「嘿 Siri」那样的唤醒词检测器，直接在浏览器里运行。'),
    tags: ['Python', 'DSP', 'DS-CNN', 'ONNX', 'WebAssembly'],
    cover: '/kws/cover.jpg',
    sections: [
      { heading: tr('The goal', '目标'), text: tr('Build a keyword-spotting pipeline from scratch, small and fast enough for edge devices: the always-listening kind of detector that wakes a voice assistant.', '从零搭建一条关键词识别流水线，足够小、足够快，能跑在端侧设备上，也就是唤醒语音助手的那种一直在听的检测器。') },
      {
        heading: tr('The pipeline', '流水线'),
        text: tr(
          'A hand-written log-mel front end (numpy) feeds a depthwise-separable CNN (DS-CNN, about 65k parameters). The model is quantized to int8 ONNX and runs in a streaming detector with a 1 s window and a 100 ms hop, plus debounce and a refractory period so one word fires once.',
          '手写的 log-mel 特征前端（numpy）接一个深度可分离卷积网络（DS-CNN，约 6.5 万参数）。模型量化为 int8 ONNX，运行在流式检测器中，窗口 1 秒、步长 100 毫秒，并加了去抖和不应期，保证一个词只触发一次。',
        ),
      },
      {
        heading: tr('Results', '结果'),
        bullets: tr(
          ['Test F1 of 0.981.', 'A 37.5 KB model (int8).', '0.15 ms inference (p50).', 'About 2.0 false accepts per hour at 10 dB SNR.'],
          ['测试集 F1 为 0.981。', '模型只有 37.5 KB（int8）。', '推理耗时 0.15 毫秒（p50）。', '10 dB 信噪比下每小时约 2.0 次误唤醒。'],
        ),
      },
      {
        heading: tr('Live demo', '在线演示'),
        text: tr(
          'Say "yes" into your mic. Feature extraction and inference both run client-side with onnxruntime-web (WebAssembly), so audio never leaves the tab: no install, no server.',
          '对着麦克风说 "yes"。特征提取和推理都通过 onnxruntime-web（WebAssembly）在本地完成，音频不会离开这个标签页：无需安装，也不需要服务器。',
        ),
      },
    ],
    links: {
      demo: 'https://huggingface.co/spaces/KuroeLove/my-kws-demo',
      github: 'https://github.com/FengkaiLiu/my_KWS',
    },
    media: [
      {
        caption: tr('Demo recording', '演示录屏'),
        items: [{ type: 'video', src: '/kws/kws.mp4', alt: tr('my_KWS demo recording', 'my_KWS 演示录屏') }],
      },
    ],
    embed: {
      title: tr('Try it here', '在这里试试'),
      src: 'https://kuroelove-my-kws-demo.static.hf.space/index.html',
      allow: 'microphone',
      note: tr('Loads the live demo from Hugging Face. It asks for your microphone; the audio stays in your browser.', '从 Hugging Face 加载在线演示。它会请求麦克风权限，音频只留在你的浏览器里。'),
    },
  },
];
