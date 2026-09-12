'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Movie {
  id: string;
  title: string;
  overview: string;
  poster_path: string;
  bayesian_rating: number;
  total_votes: number;
  raw_average: number;
}

export default function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Change 1: Voter Profile state
  const [voterName, setVoterName] = useState<string>('');
  const [tempNameInput, setTempNameInput] = useState<string>('');
  const [hasEnteredName, setHasEnteredName] = useState<boolean>(false);

  // Change 4: Persistent star ratings per movie
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

  // 1. Load saved voter name and ratings from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('movie_voter_name');
    if (savedName) {
      setVoterName(savedName);
      setTempNameInput(savedName);
      setHasEnteredName(true);
    }

    const savedRatings = localStorage.getItem('movie_user_ratings');
    if (savedRatings) {
      try {
        setUserRatings(JSON.parse(savedRatings));
      } catch (e) {
        console.error('Failed to parse saved ratings', e);
      }
    }
  }, []);

  // 2. Fetch movies and Bayesian leaderboard
  const fetchMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('movie_leaderboard')
        .select('*')
        .order('bayesian_rating', { ascending: false });

      if (error) {
        // Fallback to base movies table if view has not updated yet
        const { data: fallbackData } = await supabase.from('movies').select('*');
        if (fallbackData) setMovies(fallbackData as Movie[]);
      } else if (data) {
        setMovies(data as Movie[]);
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();

    // Realtime channel for live updates
    const channel = supabase
      .channel('realtime-ratings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        () => {
          fetchMovies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Save Voter Name (Change 1)
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNameInput.trim()) {
      const cleanName = tempNameInput.trim();
      setVoterName(cleanName);
      setHasEnteredName(true);
      localStorage.setItem('movie_voter_name', cleanName);
    }
  };

  // 4. Submit Rating and Persist Stars (Change 4)
  const handleRate = async (movieId: string, stars: number) => {
    if (!hasEnteredName) {
      alert('Please enter and save your voter name at the top before rating!');
      return;
    }

    // Immediately keep the stars colored
    const updatedRatings = { ...userRatings, [movieId]: stars };
    setUserRatings(updatedRatings);
    localStorage.setItem('movie_user_ratings', JSON.stringify(updatedRatings));

    try {
      // Ensure anonymous session or sign in
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        session = authData.session;
      }

      // Upsert/Insert rating
      const { error } = await supabase.from('ratings').insert({
        movie_id: movieId,
        rating: stars,
        user_id: session?.user.id,
      });

      if (error) {
        console.error('Failed to submit rating:', error.message);
      } else {
        fetchMovies();
      }
    } catch (err: any) {
      console.error('Submission error:', err.message || err);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Main Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              🎬 MovieVault
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Community collaborative ratings ranked via Bayesian Weighted Scoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
              ● Supabase Realtime Active
            </span>
          </div>
        </header>

        {/* Change 1: Voter Identity Banner */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
              Voter Identity
            </span>
            <p className="text-sm text-slate-200">
              {hasEnteredName ? (
                <>Voting as: <strong className="text-amber-400">{voterName}</strong></>
              ) : (
                'Enter your name to unlock movie voting'
              )}
            </p>
          </div>

          {!hasEnteredName ? (
            <form onSubmit={handleSaveName} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Enter voter name..."
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                className="px-3 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400 w-full sm:w-60"
              />
              <button
                type="submit"
                className="px-4 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
              >
                Save
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setHasEnteredName(false);
                localStorage.removeItem('movie_voter_name');
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Switch Voter
            </button>
          )}
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">
            Loading movie leaderboard...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {movies.map((movie, index) => {
              const currentScore = movie.bayesian_rating 
                ? Number(movie.bayesian_rating).toFixed(1) 
                : 'Unranked';
              const userVote = userRatings[movie.id] || 0;

              return (
                <div
                  key={movie.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between"
                >
                  <div>
                    {/* Poster + Rank */}
                    <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden">
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-600 text-xs">
                          No Poster
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-slate-700 text-xs font-bold text-white">
                        #{index + 1}
                      </div>
                    </div>

                    {/* Movie Details */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-base text-white truncate">
                        {movie.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {movie.overview || 'No synopsis provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Score & Rating Footer */}
                  <div className="p-4 pt-0 border-t border-slate-800/60 mt-2">
                    <div className="flex justify-between items-center py-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">Bayesian Rank</span>
                        <span className="font-semibold text-amber-400 text-sm">
                          {currentScore}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Total Votes</span>
                        <span className="font-semibold text-slate-300">
                          {movie.total_votes || 0}
                        </span>
                      </div>
                    </div>

                    {/* Change 4: Stars stay filled */}
                    <div className="mt-3 flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-xs text-slate-400">
                        {userVote > 0 ? `Your rating: ${userVote}★` : 'Rate this:'}
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(movie.id, star)}
                            className="text-lg leading-none transition-transform hover:scale-125 focus:outline-none"
                            title={`Rate ${star} star`}
                          >
                            <span className={star <= userVote ? 'text-amber-400' : 'text-slate-700 hover:text-amber-200'}>
                              ★
                            </span>
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