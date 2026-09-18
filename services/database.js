import { createClient } from "@supabase/supabase-js";

let supabase = null;

/*
|--------------------------------------------------------------------------
| Get Supabase Server Client
|--------------------------------------------------------------------------
|
| This client runs only on the Render backend.
|
| SUPABASE_SECRET_KEY is a server-only key and must NEVER
| be exposed to the browser or committed to GitHub.
|
|--------------------------------------------------------------------------
*/

function getSupabase() {
  if (!process.env.SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured."
    );
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
  }

  return supabase;
}

/*
|--------------------------------------------------------------------------
| Test Supabase Connection
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
| Export Server Client
|--------------------------------------------------------------------------
*/

export { getSupabase };
