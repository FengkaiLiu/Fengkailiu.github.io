// Playback engine for the record player. File tracks stream through one <audio> element;
// tracks without a file play the synthesized demo loop. Both feed the music bus, so the room
// reacts to whatever is spinning. A guest (a Liner notes pick playing in the Spotify embed)
// can borrow the turntable: the room's own music stops and the dock shows the guest.
import { getAudio, unlockAudio } from './context';
import { getMusicBus } from './bus';
import { startDemoBeat, type DemoBeat } from './demoBeat';
import type { Track } from '../content/tracks';

/** Something else borrowing the turntable: a Liner notes pick in the Spotify embed (outside
 *  the room's audio graph), or the Contact sequencer (`inRoom`: it plays through the bus). */
export interface Guest {
  id: string;
  title: string;
  artist: string;
  inRoom?: boolean;
}

/** A guest the room cannot hear (Spotify): no meters, volume or scope for it. */
export const outsideGuest = (g: Guest | null) => Boolean(g && !g.inRoom);

/** The guest's side of the turntable: report progress, and hand it back when done. */
export interface GuestSlot {
  progress(time: number, duration: number): void;
  end(): void;
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
  /** Let a guest take the turntable. `stop` is called if the room takes it back (dock play or pause). */
  host(guest: Guest, stop: () => void): GuestSlot;
  onChange(fn: (s: PlayerState) => void): void;
}

export function createPlayer(tracks: Track[]): Player {
  let index = 0;
  let playing = false;
  let guest: Guest | null = null;
  let stopGuest: (() => void) | null = null;
  let guestTime: number | null = null;
  let guestDuration: number | null = null;
  let demo: DemoBeat | null = null;
  let el: HTMLAudioElement | null = null;
  let fade: GainNode | null = null;
  const listeners: ((s: PlayerState) => void)[] = [];

  const usingElement = () => Boolean(tracks[index].src);
  const state = (): PlayerState => ({
    track: guest ? { id: guest.id, title: guest.title, artist: guest.artist } : tracks[index],
    index,
    playing,
    guest,
    time: guest ? guestTime : usingElement() && el ? el.currentTime : null,
    duration: guest ? guestDuration : usingElement() && el && Number.isFinite(el.duration) ? el.duration : null,
  });
  const emit = () => listeners.forEach((fn) => fn(state()));

  const audioEl = () => {
    if (el) return el;
    el = new Audio();
    el.preload = 'auto';
    const { ctx } = getAudio();
    fade = ctx.createGain();
    ctx.createMediaElementSource(el).connect(fade).connect(getMusicBus().input);
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

  /** Sends the guest away (pausing it if the room asked), leaving the turntable idle. */
  const dropGuest = (pauseIt: boolean) => {
    if (!guest) return;
    const stop = stopGuest;
    guest = null;
    stopGuest = null;
    guestTime = guestDuration = null;
    if (pauseIt) stop?.();
  };

  const play = async () => {
    await unlockAudio(); // first press may also be the first user gesture, if the gate was entered silently
    stopSound();
    dropGuest(true);
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

  const host = (g: Guest, stop: () => void): GuestSlot => {
    stopSound();
    dropGuest(true); // a different guest was on: pause it
    guest = g;
    stopGuest = stop;
    playing = true;
    emit();
    const mine = () => guest === g;
    return {
      progress(time, duration) {
        if (!mine()) return;
        guestTime = time;
        guestDuration = duration;
        emit();
      },
      end() {
        if (!mine()) return;
        dropGuest(false);
        playing = false;
        emit();
      },
    };
  };

  const pause = () => {
    dropGuest(true);
    stopSound();
    playing = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    emit();
  };

  const step = async (dir: number) => {
    const wasPlaying = playing;
    stopSound();
    dropGuest(true);
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
    host,
    toggle: () => (playing ? Promise.resolve(pause()) : play()),
    next: () => step(1),
    prev: () => step(-1),
    onChange(fn) {
      listeners.push(fn);
    },
  };
}
