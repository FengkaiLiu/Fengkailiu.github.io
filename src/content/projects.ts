// Project data. Each entry becomes one pinned scroll chapter (Floor 10).
// Migrated from legacy/index.html. `placeholder: true` marks entries still waiting on content.

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
    subtitle: 'A virtual reality room that visualizes Spotify music with light effects.',
    tags: ['Unity', 'CS/XR', 'Music', 'C#'],
    cover: '/PWpage/vrmusicroom.jpg',
    sections: [
      { heading: 'The problem', text: 'For my co-op project, I needed to develop an immersive VR application that could connect multiple APIs into one unified experience, something I had never done before.' },
      { heading: 'The solution', text: 'After researching both AR and VR approaches, I chose VR for its greater creative control and immersive potential. I built a virtual room that reacts to music in real time, syncing lighting and visual effects to whatever song is playing on Spotify.' },
      { heading: 'Key features', bullets: ['Integrated Spotify, Last.fm, and Gemini APIs for AI-driven music analysis and real-time synchronization.', 'Dynamic lighting that responds uniquely to every song.'] },
      { heading: 'What I learned', text: 'How to architect communication between multiple services and keep performance smooth while handling real-time data streams from different APIs.' },
    ],
    links: { github: 'https://github.com/FengkaiLiu/XR-Coop-Project' },
    media: [
      {
        caption: 'Dev stage video recording',
        items: [
          { type: 'video', src: '/vrmusicroom/demo.mp4', alt: 'VR Music Room, dev stage recording, part 1' },
          { type: 'video', src: '/vrmusicroom/demo2.mp4', alt: 'VR Music Room, dev stage recording, part 2' },
        ],
      },
      {
        caption: 'Co-op project presentation',
        items: [
          { type: 'image', src: '/vrmusicroom/shot-1.jpg', alt: 'Fengkai in the headset, the room mirrored on the monitor' },
          { type: 'image', src: '/vrmusicroom/shot-2.jpg', alt: 'The in-VR song picker shown on the monitor' },
          { type: 'image', src: '/vrmusicroom/shot-3.jpg', alt: 'Presenting the VR room in the lab' },
        ],
      },
    ],
  },
  {
    id: 'sonare',
    title: 'Sonare of the Lake',
    subtitle: 'A lyric visualizer built for the Hatsune Miku "Magical Mirai 2026" Programming Contest.',
    tags: ['Three.js', 'TextAlive API', 'Web/JS', 'Blender'],
    cover: '/PWpage/Sonare.png',
    sections: [
      { heading: 'The concept', text: 'The player sails a Vocaloid-themed boat across a stylized lake. Lyrics emerge from the water as schools of luminous particles during verses, then coalesce in the sky during choruses, turning song structure into navigable geography.' },
      { heading: "How it's built", text: 'A Vite + Three.js (r172) web app driven by the TextAlive App API for lyric, beat, and chord timing. Cannon-es powers buoyancy and boat physics, Troika Three Text renders SDF lyric glyphs, GSAP drives the cinematic camera, and Draco compresses the terrain mesh. All six character boats (Miku, Rin, Len, Luka, KAITO, MEIKO) were hand-modeled in Blender from an original cube-chibi template.' },
      { heading: 'Key features', bullets: [
        'Six playable Vocaloid boats and six song-selection portals arranged around the lake.',
        'WASD / arrow-key navigation with physics-based buoyancy and cinematic dive, chase, and sky camera modes.',
        'Particle-based lyric visualization synced to verse and chorus structure via TextAlive.',
        'Floating note pickups, wooden-plank obstacles, first-time control hints, and an end-of-song return circle.',
        'Japanese / English UI toggle and locally subsetted Kiwi Maru + Caveat fonts.',
      ] },
      { heading: 'Credits', text: 'Team FBH: Fengkai Liu (lead development, 3D modeling, visual design, QA), Brian Liu (creative direction, coding, QA), and Haolin Wang (original cube-chibi Miku base mesh, used with permission). Per contest guidelines, no generative AI was used for any music, image, illustration, or text in the output.' },
    ],
    links: {
      demo: 'https://magical-mirai-2026-sonare-of-the-la.vercel.app/',
      github: 'https://github.com/FengkaiLiu/magical-mirai-2026-sonare-of-the-lake',
    },
    media: [
      {
        caption: 'Gameplay demo',
        items: [{ type: 'video', src: '/sonareofthelake/mikuboat.mp4', alt: 'Sonare of the Lake gameplay recording' }],
      },
      {
        caption: 'In-game screenshots',
        items: [
          { type: 'image', src: '/sonareofthelake/sonare-1.jpg', alt: 'Verse lyrics rising from the lake beside the boat' },
          { type: 'image', src: '/sonareofthelake/sonare-2.jpg', alt: 'Chorus lyrics written across the sky above the mountains' },
        ],
      },
    ],
    models: {
      caption: 'The six boats, hand-modeled in Blender',
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
    subtitle: 'A self-designed VRChat world built from scratch with Unity and the VRChat SDK.',
    tags: ['Unity', 'Game Design', 'VRChat'],
    cover: '/PWpage/vrchatroom.png',
    sections: [
      { heading: 'The problem', text: 'This was my first virtual world, so I had to learn the entire pipeline from 3D environment design to SDK integration, essentially from zero.' },
      { heading: 'The solution', text: 'I learned the VRChat SDK inside Unity along with ProBuilder, Bakery, and Magic Light Probes. I integrated interactive prefabs to build a rich environment, then optimized the map from 300MB down to 50MB so it runs smoothly on standalone VR headsets.' },
      { heading: 'Key features', bullets: ['Over 1,000 interactable furniture pieces with VRChat grab functionality.', 'Built-in entertainment including a pool table, arcade machines, and more.'] },
      { heading: 'What I learned', text: 'How to combine Unity with third-party SDKs, prefabs, and plugins to build fully interactive worlds, and why aggressive optimization matters for mobile VR.' },
    ],
    links: {
      demo: 'https://vrchat.com/home/launch?worldId=wrld_1c519374-adfc-4072-9df4-21458d94a13e',
      demoLabel: 'Visit in VRChat',
      github: 'https://github.com/FengkaiLiu/VRchatRoomLowpoly',
    },
    media: [
      {
        caption: 'World intro',
        items: [{ type: 'video', src: '/vrchatroom/vrchatroom.mp4', alt: 'RoomLink-ChillZone world intro video' }],
      },
    ],
  },
  {
    id: 'hotfooter',
    title: 'Hot Footer',
    subtitle: 'A 2D cave platformer from a class project: climb to the exit before you touch the lava. Playable right here.',
    tags: ['Unity', 'C#', 'Game Programming', 'Sound'],
    cover: '/PWpage/hotfooter.png',
    game: 'lava-rising',
    sections: [
      { heading: 'The game', text: 'Climb out of a cave without touching the lava. Three levels of tight platforming with double jumps and wall jumps, a run timer, and an altimeter that fills as you climb. Near the top of Level 3 the music lifts and the altimeter starts to blink. A terminal hidden in Level 2 opens a secret level.' },
      { heading: 'What I built', bullets: [
        'The player controller: walking, running on Shift, a ground check, one double jump, and wall jumps detected with raycasts from the head and the feet.',
        'Idle, walk and run animations blended by speed in the Animator, plus jump and fall states.',
        'A smoothed camera that follows the player and stays inside each level\'s bounds.',
        'The sound system: a soundtrack choice on the title screen that changes the music in every level after it, plus the jump, landing and lava sounds.',
        'The secret level and the doors that link the levels together.',
        'The team setup: I created the repo and wrote the Git and Unity workflow guide my teammates followed.',
      ] },
      { heading: 'The team', text: 'Three of us built it in about six weeks (October to December 2024), working through GitHub and Discord. I made 25 of the project\'s 39 commits.' },
      { heading: 'This browser version', text: 'The game on this page is a port I made from the original Unity project. The levels are read straight from the Unity scene files, and the movement uses the same numbers as the C# code: 4 units per second walking, twice that running, one air jump, and wall jumps whenever the head and feet both touch a wall.' },
      { heading: 'Credits', text: 'Soundtrack (title theme, level music, secret level, victory and defeat) by Fengkai Liu, produced with Suno. The original title-screen music is by teammate Ava. Art: the Super Grotto Escape pack by Ansimuz (CC0).' },
      { heading: 'What I learned', text: 'How to collaborate through version control, and how to pick up and apply new tools quickly under a tight deadline.' },
    ],
    links: { github: 'https://github.com/GameDevGroup4/Unity-Project' },
    media: [
      {
        caption: 'From the original Unity build',
        items: [
          { type: 'image', src: '/hotfooter/shot-1.jpg', alt: 'Hotfooter title screen with Start and the Harry, Ava and Mute soundtrack buttons' },
          { type: 'image', src: '/hotfooter/shot-2.jpg', alt: 'A whole level in the Unity editor: stone platforms and a rope bridge above lava pools, with the camera frame drawn in white' },
          { type: 'image', src: '/hotfooter/shot-3.jpg', alt: 'The yellow hero standing on a stone ledge just above the lava' },
        ],
      },
    ],
  },
  {
    id: 'project5',
    title: 'my_KWS',
    subtitle: 'Edge keyword spotting from scratch: a "Hey Siri"-style wake-word detector that runs in your browser.',
    tags: ['Python', 'DSP', 'DS-CNN', 'ONNX', 'WebAssembly'],
    cover: '/kws/cover.jpg',
    sections: [
      { heading: 'The goal', text: 'Build a keyword-spotting pipeline from scratch, small and fast enough for edge devices: the always-listening kind of detector that wakes a voice assistant.' },
      {
        heading: 'The pipeline',
        text: 'A hand-written log-mel front end (numpy) feeds a depthwise-separable CNN (DS-CNN, about 65k parameters). The model is quantized to int8 ONNX and runs in a streaming detector with a 1 s window and a 100 ms hop, plus debounce and a refractory period so one word fires once.',
      },
      {
        heading: 'Results',
        bullets: ['Test F1 of 0.981.', 'A 37.5 KB model (int8).', '0.15 ms inference (p50).', 'About 2.0 false accepts per hour at 10 dB SNR.'],
      },
      {
        heading: 'Live demo',
        text: 'Say "yes" into your mic. Feature extraction and inference both run client-side with onnxruntime-web (WebAssembly), so audio never leaves the tab: no install, no server.',
      },
    ],
    links: {
      demo: 'https://huggingface.co/spaces/KuroeLove/my-kws-demo',
      github: 'https://github.com/FengkaiLiu/my_KWS',
    },
    media: [
      {
        caption: 'Demo recording',
        items: [{ type: 'video', src: '/kws/kws.mp4', alt: 'my_KWS demo recording' }],
      },
    ],
    embed: {
      title: 'Try it here',
      src: 'https://kuroelove-my-kws-demo.static.hf.space/index.html',
      allow: 'microphone',
      note: 'Loads the live demo from Hugging Face. It asks for your microphone; the audio stays in your browser.',
    },
  },
];
