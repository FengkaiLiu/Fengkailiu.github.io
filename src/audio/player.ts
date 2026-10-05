// Playback engine for the record player. File tracks stream through one <audio>
// element; tracks without a file play the synthesized demo loop. Both feed the music bus.
import { getAudio, unlockAudio } from './context';
import { getMusicBus } from './bus';
import { startDemoBeat, type DemoBeat } from './demoBeat';
import type { Track } from '../content/tracks';

export interface PlayerState {
  track: Track;
  index: number;
  playing: boolean;
  /** Seconds, or null for the endless demo loop. */
  time: number | null;
  duration: number | null;
}

export interface Player {
  state(): PlayerState;
  toggle(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  next(): Promise<void>;
  prev(): Promise<void>;
  onChange(fn: (s: PlayerState) => void): void;
}

export function createPlayer(tracks: Track[]): Player {
  let index = 0;
  let playing = false;
  let demo: DemoBeat | null = null;
  let el: HTMLAudioElement | null = null;
  const listeners: ((s: PlayerState) => void)[] = [];

  const state = (): PlayerState => ({
    track: tracks[index],
    index,
    playing,
    time: tracks[index].src && el ? el.currentTime : null,
    duration: tracks[index].src && el && Number.isFinite(el.duration) ? el.duration : null,
  });
  const emit = () => listeners.forEach((fn) => fn(state()));

  const audioEl = () => {
    if (el) return el;
    el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    getAudio().ctx.createMediaElementSource(el).connect(getMusicBus().input);
    el.addEventListener('ended', () => void step(1));
    el.addEventListener('timeupdate', emit);
    el.addEventListener('loadedmetadata', emit);
    return el;
  };

  const stopSound = () => {
    demo?.stop();
    demo = null;
    el?.pause();
  };

  const play = async () => {
    await unlockAudio(); // first press may also be the first user gesture, if the gate was entered silently
    const track = tracks[index];
    stopSound();
    if (track.src) {
      const a = audioEl();
      if (!a.src.endsWith(track.src)) a.src = track.src;
      await a.play();
    } else {
      demo = startDemoBeat(getAudio().ctx, getMusicBus().input);
    }
    playing = true;
    updateMediaSession();
    emit();
  };

  const pause = () => {
    stopSound();
    playing = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    emit();
  };

  const step = async (dir: number) => {
    const wasPlaying = playing;
    stopSound();
    index = (index + dir + tracks.length) % tracks.length;
    if (el) el.currentTime = 0;
    if (wasPlaying) await play();
    else emit();
  };

  // OS media keys and the lock-screen widget.
  const updateMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    const t = tracks[index];
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: "Fengkai's Room" });
    navigator.mediaSession.playbackState = 'playing';
  };
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => void play());
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('nexttrack', () => void step(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => void step(-1));
  }

  return {
    state,
    play,
    pause,
    toggle: () => (playing ? Promise.resolve(pause()) : play()),
    next: () => step(1),
    prev: () => step(-1),
    onChange(fn) {
      listeners.push(fn);
    },
  };
}
