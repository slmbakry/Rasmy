// Public Supabase settings. The publishable key is meant for browsers;
// every read and write is enforced by Row Level Security in the database.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ewbpshqntggizomdejys.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_LlYFMdJmhits85U8YcT-Vw_93jKXKDP";

export const sb = createClient(url, key);
