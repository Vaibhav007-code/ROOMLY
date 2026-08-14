import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
export async function supabaseServer() { const store = cookies(); return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies:{ get:(n:string)=>store.get(n)?.value, set(n:string,v:string,o:CookieOptions){ try{store.set({name:n,value:v,...o})}catch{}}, remove(n:string,o:CookieOptions){try{store.set({name:n,value:'',...o})}catch{}} } }); }
export function supabaseAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{autoRefreshToken:false,persistSession:false} }); }
export async function currentUser() { const sb=await supabaseServer(); const {data:{user}}=await sb.auth.getUser(); return {sb,user}; }
