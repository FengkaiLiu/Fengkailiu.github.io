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
  links: { demo?: string; github?: string };
  media?: MediaGroup[];
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
    links: { github: 'https://github.com/FengkaiLiu/vrmusicroom' },
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
    needs: ['Screen recording of a chorus moment (lyrics forming in the sky)', 'One boat model exported as .glb'],
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
      demo: 'https://vrchat.com/home/world/wrld_1c519374-adfc-4072-9df4-21458d94a13e/info',
      github: 'https://github.com/FengkaiLiu/VRchatRoomLowpoly',
    },
    needs: ['360° panorama screenshot of the world (equirectangular .jpg)'],
  },
  {
    id: 'hotfooter',
    title: 'Hot Footer',
    subtitle: 'A 2D platformer made for a class project.',
    tags: ['Unity', 'Game Programming', 'C#'],
    cover: '/PWpage/hotfooter.png',
    sections: [
      { heading: 'The problem', text: 'My first collaborative game project. I had to coordinate with teammates at different skill levels while learning new tools, all within a four-week deadline.' },
      { heading: 'The solution', text: 'We organized our workflow through Discord and GitHub with clearly divided responsibilities. I learned Unity 2D tools through tutorials and documentation, focusing on level design and gameplay mechanics.' },
      { heading: 'Key features', bullets: ['Challenging jump mechanics across multiple levels.', 'Custom sound effects and a hidden secret level for extra replayability.'] },
      { heading: 'What I learned', text: 'How to collaborate through version control, and how to pick up and apply new tools quickly under a tight deadline.' },
    ],
    links: { github: 'https://github.com/GameDevGroup4/Unity-Project' },
    needs: ['Unity WebGL build (optional, for a playable embed) or a gameplay GIF'],
  },
  {
    id: 'project5',
    title: 'Project 5',
    subtitle: 'Coming soon.',
    tags: ['Coming Soon'],
    cover: '',
    sections: [],
    links: {},
    needs: ['Title, subtitle, tags, cover image, write-up'],
    placeholder: true,
  },
];
