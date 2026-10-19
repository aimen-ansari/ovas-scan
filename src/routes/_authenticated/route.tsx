import { createFileRoute,Outlet,redirect } from "@tanstack/react-router";
import { supabase,isSupabaseConfigured } from "@/integrations/supabase/client";
export const Route=createFileRoute("/_authenticated")({ssr:false,beforeLoad:async()=>{
 if(!isSupabaseConfigured)throw redirect({to:"/auth"});
 let user;
 try {const {data,error}=await supabase.auth.getUser();if(error)throw error;user=data.user;}catch{throw redirect({to:"/auth"});}
 if(!user)throw redirect({to:"/auth"});return{user};
},component:()=> <Outlet/>});
