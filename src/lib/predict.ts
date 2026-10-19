import { CLASS_NAMES, type ClassName } from "./classes";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
export interface PredictionResult {
  predicted_class: ClassName; confidence: number; probabilities: Record<ClassName, number>;
  heatmap_url?: string | null; model: string; weights_sha256: string; elapsed_ms?: number;
  created_at: string; source: "live";
}
export interface ModelHealth {
  status: "ready" | "missing_weights" | "load_error" | "unconfigured" | "offline";
  model: string; message: string; requires_auth?: boolean; classes?: string[]; input_size?: number[]; weights_sha256?: string;
}
const KEY = "ovascan-api-base";
export function apiBase() {
  if (typeof window !== "undefined") { try { const saved = localStorage.getItem(KEY); if (saved) return saved; } catch {} }
  return (import.meta.env.VITE_MODEL_API_URL || "").replace(/\/+$/, "");
}
export function setApiBase(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed) {
    const u = new URL(trimmed);
    if (u.username || u.password || u.search || u.hash) throw new Error("Use a base URL without credentials, a query, or a fragment.");
    if (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) throw new Error("Use HTTPS, or HTTP for a local development server.");
  }
  if (trimmed) localStorage.setItem(KEY, trimmed); else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("ovascan-connection"));
}
export async function checkModel(): Promise<ModelHealth> {
  if (!apiBase()) return { status: "unconfigured", model: "EfficientNet-B3", message: "Connect your model service to enable live analysis." };
  try {
    const response = await fetch(`${apiBase()}/api/health`, { signal: AbortSignal.timeout(10000), credentials: "omit" });
    if (!response.ok) throw new Error();
    const h = await response.json();
    if (!["ready", "missing_weights", "load_error"].includes(h.status) || h.model !== "efficientnet_b3") throw new Error();
    if (h.status === "ready" && (JSON.stringify(h.classes) !== JSON.stringify(CLASS_NAMES) || JSON.stringify(h.input_size) !== "[224,224]" || !/^[a-f0-9]{64}$/.test(h.weights_sha256 ?? ""))) return { status: "load_error", model: "EfficientNet-B3", message: "The service’s class order or model configuration does not match this project." };
    return h;
  } catch { return { status: "offline", model: "EfficientNet-B3", message: "Could not reach the model service. Check its address and allowed origins." }; }
}
export function validatePrediction(value: unknown): PredictionResult {
  const r = value as PredictionResult;
  if (!r || !CLASS_NAMES.includes(r.predicted_class) || r.source !== "live" || r.model !== "efficientnet_b3" || !/^[a-f0-9]{64}$/.test(r.weights_sha256 ?? "")) throw new Error("The model returned an incompatible result.");
  const ps = CLASS_NAMES.map(c => r.probabilities?.[c]);
  if (ps.some(p => typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) || Math.abs(ps.reduce((a,b)=>a+b,0)-1) > .005 || !Number.isFinite(r.confidence) || Math.abs(r.confidence-r.probabilities[r.predicted_class]) > .0001 || Math.abs(r.confidence-Math.max(...ps)) > .0001 || Number.isNaN(Date.parse(r.created_at))) throw new Error("The model returned invalid probabilities.");
  if (r.heatmap_url && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.heatmap_url)) throw new Error("The model returned an unsupported heatmap.");
  return r;
}
export async function runPrediction(file: File, heatmap: boolean, signal?: AbortSignal): Promise<PredictionResult> {
  if (!apiBase()) throw new Error("Connect your trained model before running an analysis.");
  const headers: Record<string,string> = {};
  // Sign-in tokens go only to the explicitly trusted deployment origin.
  const trustedOrigin = import.meta.env.VITE_TRUSTED_MODEL_ORIGIN;
  if (isSupabaseConfigured && trustedOrigin && new URL(apiBase()).origin === trustedOrigin) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const form = new FormData(); form.append("file", file); form.append("include_heatmap", String(heatmap));
  const response = await fetch(`${apiBase()}/api/predict`, { method: "POST", headers, body: form, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000), credentials: "omit" });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(typeof error.detail === "string" ? error.detail : `Analysis failed (${response.status}). Please try again.`); }
  return validatePrediction(await response.json());
}
