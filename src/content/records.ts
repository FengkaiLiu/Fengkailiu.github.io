// "Liner notes": three songs Fengkai recommends, played through Spotify embeds.
// To fill one in: paste the song's Spotify share link (Share > Copy Song Link) into `spotify`,
// write `note` in your own voice, and fill the credits. Cover art comes from Spotify
// automatically if `cover` is left empty, or set `cover` to an image in public/.

export interface RecordPick {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  /** e.g. 'Written by A, B · Produced by C · Label D' */
  credits: string[];
  note: string;
  /** Spotify share link, like https://open.spotify.com/track/... */
  spotify?: string;
  cover?: string;
  /** Sleeve color used until real cover art loads. */
  tint: string;
  placeholder?: boolean;
}

export const records: RecordPick[] = [
  {
    id: 'pick-1',
    title: 'Song one',
    artist: 'Artist',
    album: 'Album',
    year: 'Year',
    credits: ['Written by ...', 'Produced by ...', 'Label ...'],
    note: 'Why this one? Write a few lines: when you first heard it, what to listen for, why it belongs in this room.',
    tint: '#ff9d4d',
    placeholder: true,
  },
  {
    id: 'pick-2',
    title: 'Song two',
    artist: 'Artist',
    album: 'Album',
    year: 'Year',
    credits: ['Written by ...', 'Produced by ...', 'Label ...'],
    note: 'Why this one? Maybe a production detail you love, a chord change, the mix.',
    tint: '#ff8fb1',
    placeholder: true,
  },
  {
    id: 'pick-3',
    title: 'Song three',
    artist: 'Artist',
    album: 'Album',
    year: 'Year',
    credits: ['Written by ...', 'Produced by ...', 'Label ...'],
    note: 'Why this one? The 2am song, the one that made you want to make music.',
    tint: '#a9c4ff',
    placeholder: true,
  },
];

/** `spotify:track:ID` from a share link, or null if it is missing or not a track link. */
export function spotifyUri(link?: string): string | null {
  const m = link?.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/);
  return m ? `spotify:track:${m[1]}` : null;
}
