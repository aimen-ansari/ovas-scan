import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
export function useRecords(){const {user}=useAuth();return useQuery({queryKey:["predictions",user?.id],enabled:!!user,retry:1,queryFn:async()=>{const {data,error,count}=await supabase.from("predictions").select("*",{count:"exact"}).eq("user_id",user!.id).order("created_at",{ascending:false}).limit(100);if(error)throw error;return {rows:data,count:count??0};}});}
