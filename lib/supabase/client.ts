import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// Supabase connection for the browser. Used only to upload proof photos
// straight to storage; the storage rules keep each user in their own folder.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
