// "Liner notes": three songs Fengkai recommends. For each one, fill in:
//   spotify: the song's Spotify link (in Spotify: ... > Share > Copy Song Link)
//   artist:  the artist's name, as it appears on Spotify
//   note:    why you love it, in your own voice
// Title and cover come from Spotify. Album, year and the 30 s preview that spins on the
// turntable come from Apple's public catalog (Spotify no longer offers previews), matched
// by title + artist. Anything you fill in by hand wins over the fetched value.

export interface RecordPick {
  id: string;
  spotify?: string;
  artist?: string;
  note: string;
  /** Extra credit lines, e.g. 'Produced by ...'. */
  credits?: string[];
  title?: string;
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
  /** 30 s clip, or null if no matching preview was found. */
  preview: string | null;
  /** The Spotify link, for the "full song" button. */
  link: string | null;
  missing: boolean;
}

interface AppleHit {
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]|feat\..*$/g, '')
    .replace(/[^a-z0-9À-￿]+/g, ' ')
    .trim();

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Finds the same song in Apple's catalog: same artist, and a title that matches. */
async function findOnApple(title: string, artist: string): Promise<AppleHit | null> {
  const data = await json<{ results: AppleHit[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}&entity=song&limit=15`,
  );
  const t = norm(title);
  const a = norm(artist);
  const byArtist = (data?.results ?? []).filter((h) => h.previewUrl && (norm(h.artistName).includes(a) || a.includes(norm(h.artistName))));
  return byArtist.find((h) => norm(h.trackName) === t) ?? byArtist.find((h) => norm(h.trackName).startsWith(t) || t.startsWith(norm(h.trackName))) ?? null;
}

const cache = new Map<string, Promise<ResolvedPick>>();

export function resolvePick(pick: RecordPick): Promise<ResolvedPick> {
  if (!cache.has(pick.id)) {
    cache.set(
      pick.id,
      (async () => {
        const spotify = pick.spotify?.includes('open.spotify.com/') ? pick.spotify : undefined;
        const embed = spotify ? await json<{ title: string; thumbnail_url: string }>(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotify)}`) : null;
        const title = pick.title ?? embed?.title;
        const apple = title && pick.artist ? await findOnApple(title, pick.artist) : null;
        return {
          pick,
          title: title ?? 'Song title',
          artist: pick.artist ?? apple?.artistName ?? 'Artist',
          album: pick.album ?? apple?.collectionName ?? 'Album',
          year: pick.year ?? apple?.releaseDate?.slice(0, 4) ?? 'Year',
          credits: [...(apple?.primaryGenreName ? [`Genre · ${apple.primaryGenreName}`] : []), ...(pick.credits ?? [])],
          cover: apple?.artworkUrl100?.replace('100x100bb', '600x600bb') ?? embed?.thumbnail_url ?? null,
          preview: apple?.previewUrl ?? null,
          link: spotify ?? null,
          missing: !embed || !pick.artist,
        };
      })(),
    );
  }
  return cache.get(pick.id)!;
}
