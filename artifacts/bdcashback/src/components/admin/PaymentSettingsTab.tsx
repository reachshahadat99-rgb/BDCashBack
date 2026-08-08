import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { fmtDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GatewayRow {
  id: string;
  gatewayName: string;
  enabled: boolean;
  mode: "sandbox" | "live";
  merchantId: string | null;
  secretKeyMasked: string;
  updatedBy: string | null;
  updatedAt: string;
}

interface GatewayPatch {
  enabled?: boolean;
  mode?: "sandbox" | "live";
  merchantId?: string;
  secretKey?: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
const QK = ["admin", "payment-settings"] as const;

async function fetchGateways(): Promise<GatewayRow[]> {
  return customFetch<GatewayRow[]>("/api/admin/payment-settings");
}

async function patchGateway({ id, patch }: { id: string; patch: GatewayPatch }): Promise<GatewayRow> {
  return customFetch<GatewayRow>(`/api/admin/payment-settings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ---------------------------------------------------------------------------
// Single gateway card
// ---------------------------------------------------------------------------
interface GatewayCardProps {
  gw: GatewayRow;
  onSave: (id: string, patch: GatewayPatch) => void;
  isPending: boolean;
  savedId: string | null;
}

function GatewayCard({ gw, onSave, isPending, savedId }: GatewayCardProps) {
  const [enabled, setEnabled] = useState(gw.enabled);
  const [mode, setMode] = useState<"sandbox" | "live">(gw.mode);
  const [merchantId, setMerchantId] = useState(gw.merchantId ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const dirty =
    enabled !== gw.enabled ||
    mode !== gw.mode ||
    merchantId !== (gw.merchantId ?? "") ||
    secretKey.trim() !== "";

  const justSaved = savedId === gw.id;

  function save() {
    const patch: GatewayPatch = {};
    if (enabled !== gw.enabled) patch.enabled = enabled;
    if (mode !== gw.mode) patch.mode = mode;
    if (merchantId !== (gw.merchantId ?? "")) patch.merchantId = merchantId;
    if (secretKey.trim()) patch.secretKey = secretKey.trim();
    onSave(gw.id, patch);
    setSecretKey("");
  }

  return (
    <Card className={`transition-shadow ${enabled ? "" : "opacity-60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">{gw.gatewayName}</CardTitle>
              <CardDescription className="text-xs font-mono">{gw.id}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={enabled ? "bg-green-100 text-green-700 border-none" : "bg-slate-100 text-slate-600 border-none"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20 shrink-0">Mode</Label>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              className={`px-3 py-1 transition-colors ${mode === "sandbox" ? "bg-yellow-100 text-yellow-700 font-semibold" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setMode("sandbox")}
            >
              Sandbox
            </button>
            <button
              className={`px-3 py-1 transition-colors ${mode === "live" ? "bg-green-100 text-green-700 font-semibold" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setMode("live")}
            >
              Live
            </button>
          </div>
        </div>

        {/* Merchant ID */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20 shrink-0">Merchant ID</Label>
          <Input
            className="h-8 text-xs font-mono"
            placeholder="e.g. BDC12345"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
          />
        </div>

        {/* Secret key */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20 shrink-0">Secret Key</Label>
          <div className="flex flex-1 gap-1">
            <Input
              className="h-8 text-xs font-mono flex-1"
              type={showSecret ? "text" : "password"}
              placeholder={gw.secretKeyMasked || "Enter new secret…"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        {gw.secretKeyMasked && (
          <p className="text-xs text-muted-foreground ml-[5.5rem]">
            Current: <span className="font-mono">{gw.secretKeyMasked}</span> — enter a new value to replace
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {gw.updatedAt ? `Last updated ${fmtDate(gw.updatedAt)}` : "Never updated"}
          </p>
          <div className="flex items-center gap-2">
            {justSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <Button
              size="sm"
              disabled={!dirty || isPending}
              onClick={save}
            >
              {isPending && savedId === gw.id ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------
export default function PaymentSettingsTab() {
  const queryClient = useQueryClient();
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const { data: gateways, isLoading, isError } = useQuery({
    queryKey: QK,
    queryFn: fetchGateways,
  });

  const mutation = useMutation({
    mutationFn: patchGateway,
    onSuccess: (updated) => {
      setLastSaved(updated.id);
      void queryClient.invalidateQueries({ queryKey: QK });
      setTimeout(() => setLastSaved(null), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">Failed to load payment settings. Ensure the API server is running.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 border border-blue-100">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Secret keys are stored encrypted at rest and never returned in plaintext. All changes are written to the audit log.
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {(gateways ?? []).map((gw) => (
          <GatewayCard
            key={gw.id}
            gw={gw}
            onSave={(id, patch) => mutation.mutate({ id, patch })}
            isPending={mutation.isPending}
            savedId={lastSaved}
          />
        ))}
      </div>
    </div>
  );
}
