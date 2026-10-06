// "Liner notes": three songs Fengkai recommends. For each one, fill in:
//   spotify: the song's Spotify link (in Spotify: ... > Share > Copy Song Link)
//   artist:  the artist's name, as it appears on Spotify
//   note:    why you love it, in your own voice
// The song plays in Spotify's own embed as a short preview, and the title and cover come from Spotify too. Album, year and genre are
// looked up in Apple's public catalog by title + artist and left out if it has no match.
// Anything you fill in by hand wins over the fetched value.

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
    spotify: 'https://open.spotify.com/track/6jg8bLxvV2k8gtYPkgOufy?si=91922e13feb94bac',
    artist: 'SadSvit',
    note: 'This song brings me energy',
    tint: '#ff9d4d',
  },
  {
    id: 'pick-2',
    spotify: 'https://open.spotify.com/track/7LMajLn4v2ZWmLcfE1a7DY?si=d66ea5cd6bef4c52',
    artist: 'Porter Robinson',
    note: 'This song brings me hope',
    tint: '#90ee90',
  },
  {
    id: 'pick-3',
    spotify: 'https://open.spotify.com/track/1H2pPtoPS8kNlqCN7HfT6g?si=c8ca5caaf7e744b8',
    artist: 'Jamie Paige',
    note: 'This song brings me love',
    tint: '#ff2b00',
  },
];

/** Everything the page needs to show and play one pick. */
export interface ResolvedPick {
  pick: RecordPick;
  title: string;
  artist: string;
  album: string | null;
  year: string | null;
  credits: string[];
  cover: string | null;
  /** spotify:track:... for the embed, or null without a valid link. */
  uri: string | null;
  missing: boolean;
}

interface AppleHit {
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
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

/** Finds the same song in Apple's catalog (for album, year and genre): same artist, and a title that matches. */
async function findOnApple(title: string, artist: string): Promise<AppleHit | null> {
  const data = await json<{ results: AppleHit[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}&entity=song&limit=15`,
  );
  const t = norm(title);
  const a = norm(artist);
  const byArtist = (data?.results ?? []).filter((h) => norm(h.artistName).includes(a) || a.includes(norm(h.artistName)));
  return byArtist.find((h) => norm(h.trackName) === t) ?? byArtist.find((h) => norm(h.trackName).startsWith(t) || t.startsWith(norm(h.trackName))) ?? null;
}

/** oEmbed gives a 300 px thumbnail; the same image id at the 640 px size code is the full cover. */
const bigCover = (thumb: string) => {
  const hash = thumb.match(/ab67616d0000[0-9a-f]{4}([0-9a-f]+)$/)?.[1];
  return hash ? `https://i.scdn.co/image/ab67616d0000b273${hash}` : thumb;
};

const cache = new Map<string, Promise<ResolvedPick>>();

export function resolvePick(pick: RecordPick): Promise<ResolvedPick> {
  if (!cache.has(pick.id)) {
    cache.set(
      pick.id,
      (async () => {
        const id = pick.spotify?.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/)?.[1];
        const embed = id ? await json<{ title: string; thumbnail_url: string }>(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`) : null;
        const title = pick.title ?? embed?.title;
        const apple = title && pick.artist ? await findOnApple(title, pick.artist) : null;
        return {
          pick,
          title: title ?? 'Song title',
          artist: pick.artist ?? apple?.artistName ?? 'Artist',
          album: pick.album ?? apple?.collectionName ?? null,
          year: pick.year ?? apple?.releaseDate?.slice(0, 4) ?? null,
          credits: [...(apple?.primaryGenreName ? [`Genre · ${apple.primaryGenreName}`] : []), ...(pick.credits ?? [])],
          cover: embed ? bigCover(embed.thumbnail_url) : null,
          uri: id && embed ? `spotify:track:${id}` : null,
          missing: !embed || !pick.artist,
        };
      })(),
    );
  }
  return cache.get(pick.id)!;
}
