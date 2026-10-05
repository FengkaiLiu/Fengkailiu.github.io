// "Liner notes": three songs Fengkai recommends. For each one, paste the Apple Music link
// (open the song in Apple Music > Share > Copy Link). Title, artist, album, year, cover art
// and the official 30 s preview are fetched from Apple automatically. Then write `note` in
// your own voice. Any field you fill in by hand wins over the fetched one.

export interface RecordPick {
  id: string;
  /** Apple Music song link, like https://music.apple.com/us/album/.../123?i=456 */
  apple?: string;
  /** Optional link for the "full song" button, e.g. a Spotify share link. */
  full?: string;
  note: string;
  /** Extra credit lines, e.g. 'Produced by ...'. */
  credits?: string[];
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  /** Sleeve color shown until the cover loads. */
  tint: string;
}

export const records: RecordPick[] = [
  {
    id: 'pick-1',
    note: 'Why this one? Write a few lines: when you first heard it, what to listen for, why it belongs in this room.',
    tint: '#ff9d4d',
  },
  {
    id: 'pick-2',
    note: 'Why this one? Maybe a production detail you love, a chord change, the mix.',
    tint: '#ff8fb1',
  },
  {
    id: 'pick-3',
    note: 'Why this one? The 2am song, the one that made you want to make music.',
    tint: '#a9c4ff',
  },
];

/** Everything the page needs to show and play one pick. */
export interface ResolvedPick {
  pick: RecordPick;
  title: string;
  artist: string;
  album: string;
  year: string;
  credits: string[];
  cover: string | null;
  preview: string | null;
  link: string | null;
  missing: boolean;
}

const appleId = (link?: string) => link?.match(/[?&]i=(\d+)/)?.[1] ?? link?.match(/\/song\/[^/]+\/(\d+)/)?.[1] ?? null;

const cache = new Map<string, Promise<ResolvedPick>>();

/** Looks the song up on Apple's public iTunes API (no key needed, CORS-enabled). */
export function resolvePick(pick: RecordPick): Promise<ResolvedPick> {
  if (!cache.has(pick.id)) {
    cache.set(
      pick.id,
      (async () => {
        const id = appleId(pick.apple);
        type Hit = { trackName?: string; artistName?: string; collectionName?: string; releaseDate?: string; artworkUrl100?: string; previewUrl?: string; trackViewUrl?: string; primaryGenreName?: string };
        let hit: Hit | undefined;
        if (id) {
          try {
            hit = (await (await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song`)).json()).results?.[0];
          } catch {
            hit = undefined;
          }
        }
        return {
          pick,
          title: pick.title ?? hit?.trackName ?? 'Song title',
          artist: pick.artist ?? hit?.artistName ?? 'Artist',
          album: pick.album ?? hit?.collectionName ?? 'Album',
          year: pick.year ?? hit?.releaseDate?.slice(0, 4) ?? 'Year',
          credits: [...(hit?.primaryGenreName ? [`Genre · ${hit.primaryGenreName}`] : []), ...(pick.credits ?? [])],
          cover: hit?.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null,
          preview: hit?.previewUrl ?? null,
          link: pick.full ?? hit?.trackViewUrl ?? null,
          missing: !hit,
        };
      })(),
    );
  }
  return cache.get(pick.id)!;
}
