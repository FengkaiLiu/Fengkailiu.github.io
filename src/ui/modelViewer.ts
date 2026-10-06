// A small 3D viewer for a project's models (Sonare's six boats): pick one, drag to spin it,
// and it bobs on a little patch of water. Its own WebGL canvas, alive only while shown.
import {
  AmbientLight,
  Box3,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface ModelItem {
  name: string;
  src: string;
  color: string;
}

const LENGTH = 4; // every boat is fitted to this length, so they compare side by side

export function mountModelViewer(host: HTMLElement, items: ModelItem[]) {
  host.innerHTML = `
    <div class="viewer">
      <canvas class="viewer__canvas" aria-label="3D model, drag to spin"></canvas>
      <p class="viewer__hint" aria-hidden="true">Drag to spin</p>
      <p class="viewer__loading" data-loading>Loading…</p>
    </div>
    <div class="viewer__picks" role="radiogroup" aria-label="Choose a boat">
      ${items.map((m, i) => `<button class="viewer__pick" type="button" role="radio" aria-checked="${i === 0}" data-pick="${i}" style="--c:${m.color}">${m.name}</button>`).join('')}
    </div>
  `;
  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
  const loadingEl = host.querySelector<HTMLElement>('[data-loading]')!;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(6.2, 3.6, 7.4);
  scene.add(new HemisphereLight('#dff4ff', '#2a5a7a', 1.6), new AmbientLight('#ffffff', 0.35));
  const sun = new DirectionalLight('#fff2dc', 2.2);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  // A round patch of lake with a soft ripple ring.
  const water = new Mesh(new CircleGeometry(4.2, 64), new MeshStandardMaterial({ color: '#3b9ccf', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  const ripple = new Mesh(new RingGeometry(2.6, 2.75, 64), new MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.35 }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.01;
  scene.add(water, ripple);

  const boat = new Group();
  scene.add(boat);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.6, 0);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.35;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.4;

  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<Object3D>>();
  const load = (src: string) => {
    if (!cache.has(src)) {
      cache.set(
        src,
        loader.loadAsync(src).then((gltf) => {
          const model = gltf.scene;
          // Fit to a common length and sit the hull a little into the water.
          const box = new Box3().setFromObject(model);
          const size = box.getSize(new Vector3());
          const k = LENGTH / Math.max(size.x, size.z);
          model.scale.setScalar(k);
          const center = box.getCenter(new Vector3());
          model.position.set(-center.x * k, -box.min.y * k - 0.18, -center.z * k);
          return model;
        }),
      );
    }
    return cache.get(src)!;
  };

  let current = -1;
  const pick = async (i: number) => {
    current = i;
    host.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.pick) === i)));
    ripple.material.color = new Color(items[i].color).lerp(new Color('#ffffff'), 0.5);
    loadingEl.hidden = false;
    try {
      const model = await load(items[i].src);
      if (current !== i) return; // picked another while loading
      boat.clear();
      boat.add(model);
    } finally {
      if (current === i) loadingEl.hidden = true;
    }
  };
  host.querySelector('.viewer__picks')!.addEventListener('click', (e) => {
    const i = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]')?.dataset.pick;
    if (i !== undefined) void pick(Number(i));
  });

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizer = new ResizeObserver(fit);
  resizer.observe(canvas);

  let raf = 0;
  let alive = true;
  const frame = (now: number) => {
    if (!alive) return;
    const t = now / 1000;
    // Bob and rock, like it's moored on a calm day.
    boat.position.y = Math.sin(t * 1.6) * 0.06;
    boat.rotation.z = Math.sin(t * 1.1) * 0.035;
    boat.rotation.x = Math.sin(t * 0.9 + 1) * 0.025;
    ripple.scale.setScalar(1 + ((t * 0.25) % 1) * 0.35);
    (ripple.material as MeshStandardMaterial).opacity = 0.35 * (1 - ((t * 0.25) % 1));
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  fit();
  void pick(0);
  raf = requestAnimationFrame(frame);

  return {
    /** Stop rendering and free the GPU context (the sheet moved on or closed). */
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      resizer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
