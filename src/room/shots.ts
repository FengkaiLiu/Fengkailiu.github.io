// Camera shots, one per page section. `frame` shifts the subject sideways on screen
// (fraction of viewport width) so the text card has room on the left.

export interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  frame?: number;
}

export const shots: Record<string, Shot> = {
  hero: { pos: [8.4, 6.2, 8.4], target: [-0.5, 1.9, -0.6], frame: 0.2 },
  about: { pos: [2.4, 2.55, -0.85], target: [0.75, 1.8, -3.4] },
  vrmusicroom: { pos: [-0.9, 3.25, -1.0], target: [-2.5, 2.85, -3.8] },
  sonare: { pos: [0.4, 3.3, 1.1], target: [-3.95, 3.2, 1.1] },
  roomlink: { pos: [0.4, 3.05, 2.35], target: [-3.95, 3.0, 2.35] },
  hotfooter: { pos: [-1.35, 2.55, -1.85], target: [-2.4, 2.28, -3.8] },
  project5: { pos: [3.2, 3.05, -1.1], target: [3.05, 3.0, -3.97] },
  lab: { pos: [0.5, 2.35, -1.45], target: [-0.2, 1.68, -3.25] },
  contact: { pos: [0.85, 2.95, -0.4], target: [0.8, 2.95, -3.98], frame: 0.16 },
};

export const DEFAULT_FRAME = 0.18;
