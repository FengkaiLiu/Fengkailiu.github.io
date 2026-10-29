// The record player's playlist. To add your own music, drop files in public/audio/
// and add an entry with `src: '/audio/your-file.mp3'`. Entries without `src` play the
// live-synthesized demo loop.
import { tr } from '../i18n';

export interface Track {
  id: string;
  title: string;
  artist: string;
  src?: string;
}

export const tracks: Track[] = [
  { id: 'room-tone', title: 'room tone', artist: tr('demo loop, synthesized live', '演示循环，实时合成') },
];
