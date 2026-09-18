import { createClient } from "@supabase/supabase-js";

let supabase = null;

function getSupabase() {
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  if (!process.env.SUPABASE_KEY) {
    throw new Error("SUPABASE_KEY is not configured.");
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  return supabase;
}

/*
|--------------------------------------------------------------------------
| Test Supabase connection
|--------------------------------------------------------------------------
*/

export async function testDatabaseConnection() {
  const db = getSupabase();

  const { data, error } = await db
    .from("businesses")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(
      `Supabase connection failed: ${error.message}`
    );
  }

  return {
    success: true,
    connected: true,
    rows_found: data?.length || 0
  };
}

/*
|--------------------------------------------------------------------------
| Get Supabase client
|--------------------------------------------------------------------------
*/

export { getSupabase };
