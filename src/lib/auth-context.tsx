import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
interface AuthCtx { user: User | null; session: Session | null; loading: boolean; }
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,setSession] = useState<Session|null>(null);
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let alive=true;
    const { data } = supabase.auth.onAuthStateChange((_event,s) => { if(alive){setSession(s);setLoading(false);} });
    supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setLoading(false);}}).catch(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;data.subscription.unsubscribe();};
  },[]);
  return <Ctx.Provider value={{user:session?.user??null,session,loading}}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
