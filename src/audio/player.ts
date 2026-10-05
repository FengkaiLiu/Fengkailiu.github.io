// Playback engine for the record player. File tracks and guest clips (Liner notes previews)
// stream through one <audio> element; tracks without a file play the synthesized demo loop.
// Everything feeds the music bus, so the room reacts to whatever is spinning.
import { getAudio, unlockAudio } from './context';
import { getMusicBus } from './bus';
import { startDemoBeat, type DemoBeat } from './demoBeat';
import type { Track } from '../content/tracks';

/** A song borrowed for a short spin, e.g. a recommended track's 30 s preview. */
export interface Guest {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export interface PlayerState {
  track: Track;
  index: number;
  playing: boolean;
  /** Set while a guest clip is on the turntable. */
  guest: Guest | null;
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
  /** Play a guest clip for at most `maxSeconds`, then go quiet. */
  spin(guest: Guest, maxSeconds?: number): Promise<void>;
  onChange(fn: (s: PlayerState) => void): void;
}

export function createPlayer(tracks: Track[]): Player {
  let index = 0;
  let playing = false;
  let guest: Guest | null = null;
  let guestTimer = 0;
  let demo: DemoBeat | null = null;
  let el: HTMLAudioElement | null = null;
  let fade: GainNode | null = null;
  const listeners: ((s: PlayerState) => void)[] = [];

  const usingElement = () => Boolean(guest || tracks[index].src);
  const state = (): PlayerState => ({
    track: guest ? { id: guest.id, title: guest.title, artist: guest.artist, src: guest.src } : tracks[index],
    index,
    playing,
    guest,
    time: usingElement() && el ? el.currentTime : null,
    duration: usingElement() && el && Number.isFinite(el.duration) ? el.duration : null,
  });
  const emit = () => listeners.forEach((fn) => fn(state()));

  const audioEl = () => {
    if (el) return el;
    el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous'; // previews come from Apple's CDN, which allows it; needed to analyse them
    const { ctx } = getAudio();
    fade = ctx.createGain();
    ctx.createMediaElementSource(el).connect(fade).connect(getMusicBus().input);
    el.addEventListener('ended', () => (guest ? endGuest() : void step(1)));
    el.addEventListener('timeupdate', emit);
    el.addEventListener('loadedmetadata', emit);
    return el;
  };

  const stopSound = () => {
    demo?.stop();
    demo = null;
    el?.pause();
    window.clearTimeout(guestTimer);
  };

  const endGuest = () => {
    stopSound();
    guest = null;
    playing = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    emit();
  };

  const play = async () => {
    await unlockAudio(); // first press may also be the first user gesture, if the gate was entered silently
    stopSound();
    guest = null;
    const track = tracks[index];
    if (track.src) {
      const a = audioEl();
      fade!.gain.value = 1;
      if (!a.src.endsWith(track.src)) a.src = track.src;
      await a.play();
    } else {
      demo = startDemoBeat(getAudio().ctx, getMusicBus().input);
    }
    playing = true;
    updateMediaSession();
    emit();
  };

  const spin = async (g: Guest, maxSeconds = 30) => {
    await unlockAudio();
    stopSound();
    guest = g;
    const a = audioEl();
    a.src = g.src;
    a.currentTime = 0;
    const { ctx } = getAudio();
    fade!.gain.cancelScheduledValues(ctx.currentTime);
    fade!.gain.setValueAtTime(1, ctx.currentTime);
    playing = true;
    emit();
    try {
      await a.play();
    } catch {
      endGuest();
      return;
    }
    // Fade the last 2 s, then hand the turntable back.
    guestTimer = window.setTimeout(() => {
      fade!.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      guestTimer = window.setTimeout(endGuest, 2000);
    }, Math.max(maxSeconds - 2, 0) * 1000);
    updateMediaSession();
  };

  const pause = () => {
    if (guest) return endGuest();
    stopSound();
    playing = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    emit();
  };

  const step = async (dir: number) => {
    const wasPlaying = playing;
    stopSound();
    guest = null;
    index = (index + dir + tracks.length) % tracks.length;
    if (el) el.currentTime = 0;
    if (wasPlaying) await play();
    else {
      playing = false;
      emit();
    }
  };

  // OS media keys and the lock-screen widget.
  const updateMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    const t = state().track;
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
    spin,
    toggle: () => (playing ? Promise.resolve(pause()) : play()),
    next: () => step(1),
    prev: () => step(-1),
    onChange(fn) {
      listeners.push(fn);
    },
  };
}
