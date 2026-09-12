import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPopularMovies } from '@/lib/tmdb';

export async function GET() {
  try {
    console.log('--- Step 1: Testing TMDB API call ---');
    const movies = await getPopularMovies();
    console.log('TMDB Success! Movies fetched:', movies.length);

    const records = movies.slice(0, 10).map((m) => ({
      tmdb_id: m.id,
      title: m.title,
      overview: m.overview || '',
      poster_path: m.poster_path || '',
      release_date: m.release_date || '',
    }));

    console.log('--- Step 2: Testing Supabase DB Insert ---');
    const { data, error } = await supabase
      .from('movies')
      .upsert(records, { onConflict: 'tmdb_id' })
      .select();

    if (error) {
      console.error('Supabase DB Error:', error);
      return NextResponse.json({ stage: 'SUPABASE_INSERT_FAILED', error }, { status: 500 });
    }

    console.log('Supabase Success! Movies saved:', data?.length);
    return NextResponse.json({
      message: 'Successfully populated movies catalog!',
      count: data?.length,
      movies: data,
    });
  } catch (err: any) {
    console.error('CRITICAL SEED ERROR:', err);
    return NextResponse.json(
      {
        stage: 'API_FETCH_OR_SYSTEM_FAILED',
        error: err.message || String(err),
      },
      { status: 500 }
    );
  }
}