// Personal info shown across the site. Migrated from legacy/index.html.
import { tr } from '../i18n';

export const profile = {
  name: 'Fengkai Liu',
  role: tr('CS + Music Technology', '计算机科学 + 音乐科技'),
  tagline: tr(
    'I build things where code meets sound: VR worlds, lyric visualizers, games, and tools that feel alive.',
    '我做代码与声音交汇的东西：VR 世界、歌词可视化、游戏，还有用起来有生命感的工具。',
  ),
  bio: tr(
    [
      "Hi! I'm Fengkai, a developer and creative technologist who loves building products that are both beautiful and functional. The best experiences come from blending art with engineering.",
      "When I'm not coding or designing virtual worlds, I'm producing music, experimenting with photography, or diving into the latest XR technologies.",
    ],
    [
      '你好！我是 Fengkai，一名开发者和创意技术人，喜欢做既好看又好用的产品。我相信最好的体验来自艺术与工程的结合。',
      '不写代码、不搭虚拟世界的时候，我在做音乐、玩摄影，或者研究最新的 XR 技术。',
    ],
  ),
  skills: {
    code: ['Java', 'Python', 'C#', 'C (DSP)', 'TypeScript', 'HTML/CSS', 'Three.js', 'Unity'],
    sound: ['Max/MSP', 'FL Studio', 'DSP', tr('Sound Design', '声音设计')],
    visual: ['Blender', 'Adobe PS/PR', tr('Photography', '摄影')],
  },
  stats: [
    { value: '5+', label: tr('Projects', '项目') },
    { value: '2', label: tr('Intern / Co-op', '实习 / Co-op') },
    { value: '∞', label: tr('Curiosity', '好奇心') },
  ],
  links: {
    email: 'liu.fengk@northeastern.edu',
    github: 'https://github.com/FengkaiLiu',
    linkedin: 'https://www.linkedin.com/in/fengkai-liu-a62579293',
    instagram: 'https://www.instagram.com/harrydn_kaikai/',
  },
} as const;
