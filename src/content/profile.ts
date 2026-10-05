// Personal info shown across the site. Migrated from legacy/index.html.

export const profile = {
  name: 'Fengkai Liu',
  role: 'CS + Music Technology',
  tagline: 'I build things where code meets sound: VR worlds, lyric visualizers, games, and tools that feel alive.',
  bio: [
    "Hi! I'm Fengkai, a developer and creative technologist who loves building products that are both beautiful and functional. The best experiences come from blending art with engineering.",
    "When I'm not coding or designing virtual worlds, I'm producing music, experimenting with photography, or diving into the latest XR technologies.",
  ],
  skills: {
    code: ['Java', 'Python', 'C#', 'C (DSP)', 'TypeScript', 'HTML/CSS', 'Three.js', 'Unity'],
    sound: ['Max/MSP', 'FL Studio', 'DSP', 'Sound Design'],
    visual: ['Blender', 'Adobe PS/PR', 'Photography'],
  },
  stats: [
    { value: '5+', label: 'Projects' },
    { value: '2', label: 'Intern / Co-op' },
    { value: '∞', label: 'Curiosity' },
  ],
  links: {
    email: 'liu.fengk@northeastern.edu',
    github: 'https://github.com/FengkaiLiu',
    linkedin: 'https://www.linkedin.com/in/fengkai-liu-a62579293',
    instagram: 'https://www.instagram.com/harrydn_kaikai/',
  },
} as const;
