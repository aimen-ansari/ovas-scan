import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cable, CheckCircle2, Loader2, RefreshCw, CircleDashed } from "lucide-react";
import { apiBase, checkModel, setApiBase } from "@/lib/predict";
import { toast } from "sonner";
export function useModelHealth() {
  const cache = useQueryClient();
  useEffect(() => {
    const cb = () => cache.invalidateQueries({ queryKey: ["model-health"] });
    window.addEventListener("ovascan-connection", cb);
    return () => window.removeEventListener("ovascan-connection", cb);
  }, [cache]);
  return useQuery({
    queryKey: ["model-health"],
    queryFn: checkModel,
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
export function ModelBadge({ onClick }: { onClick: () => void }) {
  const { data } = useModelHealth();
  return (
    <button onClick={onClick} className={`model-badge ${data?.status === "ready" ? "ready" : ""}`}>
      {data?.status === "ready" ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
      <span>{data?.status === "ready" ? "Model connected" : "Model awaiting connection"}</span>
    </button>
  );
}
export function ConnectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, refetch } = useModelHealth();
  useEffect(() => {
    if (open) setUrl(apiBase());
  }, [open]);
  async function connect() {
    try {
      setApiBase(url);
      setBusy(true);
      const { data: h } = await refetch();
      if (h?.status === "ready") toast.success("Trained model is ready");
      else toast.info(h?.message || "Connection saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection could not be saved");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="connection-dialog">
        <DialogHeader>
          <div className="soft-icon">
            <Cable size={24} />
          </div>
          <DialogTitle>Connect your trained model</DialogTitle>
          <DialogDescription>
            The web workspace connects to the Python model service included in your project.
          </DialogDescription>
        </DialogHeader>
        <div className={`connection-status ${data?.status === "ready" ? "connected" : ""}`}>
          <strong>
            {data?.status === "ready" ? "Ready for live analysis" : "Live analysis is not enabled"}
          </strong>
          <p>{data?.message}</p>
        </div>
        <div className="setup-list">
          <div>
            <b>1</b>
            <p>
              Place <code>efficientnet_b3_best.pth</code> in the backend’s <code>models</code>{" "}
              folder.
            </p>
          </div>
          <div>
            <b>2</b>
            <p>Start the model service using the included setup guide.</p>
          </div>
          <div>
            <b>3</b>
            <p>Enter its base URL below and check the connection.</p>
          </div>
        </div>
        <Label htmlFor="model-url">Model service URL</Label>
        <Input
          id="model-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-model-service.example"
        />
        <p className="microcopy">
          Saved on this device. Local development can use http://127.0.0.1:8000. Authenticated
          services also need the trusted model origin configured in the project.
        </p>
        <Button disabled={busy} onClick={connect}>
          {busy ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}Save &
          check connection
        </Button>
      </DialogContent>
    </Dialog>
  );
}
