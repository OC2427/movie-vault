const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN;

async function fetchFromTMDB(endpoint: string) {
  const res = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`TMDB API call failed: ${res.statusText}`);
  }

  return res.json();
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  trailer_key?: string;
}

export async function getPopularMovies(): Promise<TMDBMovie[]> {
  const data = await fetchFromTMDB('/movie/popular?language=en-US&page=1');
  return data.results;
}

export async function getMovieTrailer(tmdbId: number): Promise<string | null> {
  try {
    const data = await fetchFromTMDB(`/movie/${tmdbId}/videos?language=en-US`);
    const trailer = data.results?.find(
      (vid: any) => vid.site === 'YouTube' && (vid.type === 'Trailer' || vid.type === 'Teaser')
    );
    return trailer ? trailer.key : null;
  } catch {
    return null;
  }
}