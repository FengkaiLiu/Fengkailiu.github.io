// Spotify's iFrame embed API, loaded on first use. Visitors hear a 30 s preview, or the full
// song if they are logged in to Spotify in this browser.

export interface PlaybackUpdate {
  isPaused: boolean;
  isBuffering: boolean;
  /** Milliseconds. */
  position: number;
  duration: number;
}

export interface SpotifyController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  addListener(event: 'ready', fn: () => void): void;
  addListener(event: 'playback_update', fn: (e: { data: PlaybackUpdate }) => void): void;
}

interface IFrameAPI {
  createController(el: HTMLElement, opts: { uri: string; width?: string | number; height?: number }, cb: (c: SpotifyController) => void): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

let api: Promise<IFrameAPI> | null = null;
const loadApi = () =>
  (api ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = () => {
      api = null;
      reject(new Error('Spotify embed failed to load'));
    };
    document.head.append(script);
  }));

/** Replaces `el` with a compact Spotify player for `uri`; resolves once it is ready to play. */
export async function createSpotifyPlayer(el: HTMLElement, uri: string): Promise<SpotifyController> {
  const IFrame = await loadApi();
  return new Promise((resolve) => {
    IFrame.createController(el, { uri, width: '100%', height: 80 }, (c) => {
      let done = false;
      c.addListener('ready', () => {
        if (!done) resolve(c);
        done = true;
      });
    });
  });
}
