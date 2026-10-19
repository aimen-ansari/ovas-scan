import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </span>
            OvarianAI
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            AI-assisted multiclass classification of ovarian ultrasound scans. A research
            prototype — not a substitute for professional medical diagnosis.
          </p>
        </div>
        <div>
          <div className="text-sm font-medium">Platform</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/upload" className="hover:text-foreground">Upload</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
            <li><Link to="/history" className="hover:text-foreground">History</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-medium">Project</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/research" className="hover:text-foreground">Research</Link></li>
            <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} OvarianAI Research. For educational use only.
        </div>
      </div>
    </footer>
  );
}
