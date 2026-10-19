import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ScanLine, LayoutDashboard, History, BookOpen, ArrowUpRight, LogOut, SlidersHorizontal, Heart, Menu, X, CircleHelp, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectionDialog, ModelBadge } from "@/components/ConnectionDialog";
import { toast } from "sonner";
const navigation = [ {to:"/",label:"New analysis",icon:ScanLine}, {to:"/dashboard",label:"Overview",icon:LayoutDashboard}, {to:"/history",label:"Scan history",icon:History}, {to:"/research",label:"Research & models",icon:BookOpen} ] as const;
export function SiteShell({children}: {children:ReactNode}) {
  const {user} = useAuth(); const location=useLocation(); const navigate=useNavigate(); const cache=useQueryClient();
  const [mobile,setMobile]=useState(false); const [connection,setConnection]=useState(false);
  const active=navigation.find(n=>n.to===location.pathname)?.label ?? ({"/auth":"Your account","/about":"About OvaScan","/contact":"Project contact","/upload":"New analysis"}[location.pathname] || "Workspace");
  async function signout(){try{const {error}=await supabase.auth.signOut(); if(error)throw error;cache.clear();navigate({to:"/"});toast.success("Signed out");}catch{toast.error("Could not sign out. Please try again.");}}
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    {mobile && <button aria-label="Close navigation" className="sidebar-scrim" onClick={()=>setMobile(false)}/>}
    <aside className={`side-nav ${mobile?"is-open":""}`}>
      <Link to="/" className="brand"><span className="brand-icon"><ScanLine size={25}/></span><span>ova<span className="brand-light">scan</span><small>ULTRASOUND RESEARCH</small></span></Link>
      <button className="mobile-close" onClick={()=>setMobile(false)} aria-label="Close menu"><X/></button>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(n=><Link key={n.to} to={n.to} onClick={()=>setMobile(false)} className={location.pathname===n.to || (n.to==="/"&&location.pathname==="/upload")?"nav-link active":"nav-link"}><n.icon size={19}/>{n.label}{n.to==="/"&&<span className="nav-add">+</span>}</Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="research-note"><Heart size={21}/><strong>Science with care.</strong><p>A workspace for ovarian ultrasound research.</p><Link to="/about">Meet the project <ArrowUpRight size={15}/></Link></div>
        <button className="nav-link" onClick={()=>{setConnection(true);setMobile(false);}}><SlidersHorizontal size={18}/>Model connection</button>
        <Link className="nav-link" to="/contact"><CircleHelp size={18}/>Project contact</Link>
        <div className="profile-row"><span className="avatar">{user?.email?.[0]?.toUpperCase() || "R"}</span><div><strong>{user?.user_metadata?.full_name || (user ? "Researcher" : "Research workspace")}</strong><small>{user ? "Personal account" : "Preview access"}</small></div>{user ? <button onClick={signout} aria-label="Sign out"><LogOut size={17}/></button>:<Link to="/auth" aria-label="Sign in"><ArrowRight size={17}/></Link>}</div>
      </div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" onClick={()=>setMobile(true)} aria-label="Open menu"><Menu/></button><span>Workspace</span><span className="crumb-divider">/</span><strong>{active}</strong></div><div className="topbar-actions"><ModelBadge onClick={()=>setConnection(true)}/><span className="topbar-divider"/><span className="research-tag">RESEARCH EDITION</span></div></header>
      <main id="main" className="main-content">{children}</main>
      <footer className="workspace-footer"><span>OvaScan <span className="footer-dot">·</span> Built by Aimen</span><span>Research & education only. Not a clinical diagnosis.</span><Link to="/research">Research notes <ArrowUpRight size={13}/></Link></footer>
    </div>
    <ConnectionDialog open={connection} onOpenChange={setConnection}/>
  </div>;
}
