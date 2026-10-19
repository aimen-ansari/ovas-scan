import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAV: { to: string; label: string; auth?: boolean }[] = [
  { to: "/", label: "Home" },
  { to: "/upload", label: "Upload", auth: true },
  { to: "/dashboard", label: "Dashboard", auth: true },
  { to: "/history", label: "History", auth: true },
  { to: "/research", label: "Research" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function Nav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-[15px]">
            Ovarian<span className="text-primary">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.filter((n) => !n.auth || user).map((n) => (
            <Link
              key={n.to}
              to={n.to as "/"}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "!text-foreground !bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup" } as never}>Get started</Link></Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {NAV.filter((n) => !n.auth || user).map((n) => (
              <Link
                key={n.to}
                to={n.to as "/"}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 border-t pt-3">
              {user ? (
                <Button className="w-full" variant="outline" onClick={signOut}>Sign out</Button>
              ) : (
                <Button asChild className="w-full"><Link to="/auth">Sign in</Link></Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
