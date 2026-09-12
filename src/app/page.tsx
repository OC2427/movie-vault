'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, Film, Flame, Award, Loader2 } from 'lucide-react';

interface LeaderboardMovie {
  id: string;
  tmdb_id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  vote_count: number;
  avg_rating: number;
  bayesian_score: number;
}

export default function HomePage() {
  const [movies, setMovies] = useState<LeaderboardMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [hoveredRating, setHoveredRating] = useState<{ [movieId: string]: number }>({});

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('movie_leaderboard')
      .select('*')
      .order('bayesian_score', { ascending: false });

    if (!error && data) {
      setMovies(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();

    // Supabase Realtime: updates live across windows when anyone votes
    const channel = supabase
      .channel('realtime-ratings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRate = async (movieId: string, score: number) => {
    setSubmittingId(movieId);

    const { data: { session } } = await supabase.auth.getSession();
    let userId = session?.user?.id;

    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !authData.user) {
        alert('Could not authenticate session. Please ensure Supabase Anonymous Auth is enabled.');
        setSubmittingId(null);
        return;
      }
      userId = authData.user.id;
    }

    const { error } = await supabase.from('ratings').upsert(
      {
        movie_id: movieId,
        user_id: userId,
        score: score,
      },
      { onConflict: 'movie_id,user_id' }
    );

    if (error) {
      alert(`Rating failed: ${error.message}`);
    } else {
      fetchLeaderboard();
    }

    setSubmittingId(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Film className="w-8 h-8 text-amber-400" />
              <h1 className="text-3xl font-bold tracking-tight text-white">MovieVault</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Community ratings ranked fairly using Bayesian Weighted Averages.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>Supabase Realtime Active</span>
          </div>
        </header>

        {/* Content */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-sm text-slate-400">Loading live rankings...</p>
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <p className="text-slate-400">No movies found in database.</p>
            <p className="text-xs text-slate-500 mt-2">
              Visit <code className="bg-slate-800 px-2 py-1 rounded">/api/seed-movies</code> to populate the catalog.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {movies.map((movie, index) => {
              const activeRating = hoveredRating[movie.id] || 0;

              return (
                <div
                  key={movie.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden">
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        No Image
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-700">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>#{index + 1}</span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-white line-clamp-1">{movie.title}</h2>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {movie.overview || 'No synopsis provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between py-2 px-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-500 block">Bayesian Rank</span>
                        <span className="font-bold text-amber-400 text-sm">
                          {movie.bayesian_score > 0 ? movie.bayesian_score.toFixed(2) : 'Unranked'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Total Votes</span>
                        <span className="font-medium text-slate-300">{movie.vote_count}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Rate this:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            disabled={submittingId === movie.id}
                            onMouseEnter={() =>
                              setHoveredRating((prev) => ({ ...prev, [movie.id]: star }))
                            }
                            onMouseLeave={() =>
                              setHoveredRating((prev) => ({ ...prev, [movie.id]: 0 }))
                            }
                            onClick={() => handleRate(movie.id, star)}
                            className="p-1 text-slate-600 hover:text-amber-400 transition disabled:opacity-50"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= activeRating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}