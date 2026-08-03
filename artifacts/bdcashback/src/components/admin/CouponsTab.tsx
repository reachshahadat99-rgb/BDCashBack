import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import {
  useListAdminCoupons,
  useCreateAdminCoupon,
  useModerateAdminCoupon,
  getListAdminCouponsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { statusBadge } from "./admin-helpers";

export default function CouponsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminCoupons();
  const moderate = useModerateAdminCoupon();
  const create = useCreateAdminCoupon();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "", title: "", discountType: "percent" as "percent" | "fixed",
    discountValue: "10", minOrderValue: "0", maxUses: "0",
    startsAt: new Date().toISOString().slice(0, 10), endsAt: "",
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminCouponsQueryKey() });

  function setStatus(id: string, status: "approved" | "rejected" | "archived") {
    moderate.mutate({ id, data: { status } }, { onSuccess: invalidate });
  }

  function submit() {
    setError(null);
    if (!form.code.trim() || !form.title.trim() || !form.endsAt) {
      setError("Code, title and end date are required.");
      return;
    }
    create.mutate(
      { data: {
        code: form.code.trim().toUpperCase(), title: form.title.trim(),
        discountType: form.discountType, discountValue: Number(form.discountValue),
        minOrderValue: Number(form.minOrderValue) || 0, maxUses: Number(form.maxUses) || 0,
        startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
      } },
      {
        onSuccess: () => { setOpen(false); invalidate(); },
        onError: (err: unknown) =>
          setError(err && typeof err === "object" && "error" in err && typeof err.error === "string" ? err.error : "Could not create the coupon."),
      },
    );
  }

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Global coupon</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Scope</TableHead>
            <TableHead>Discount</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-bold">{c.code}</TableCell>
                <TableCell>{c.title}</TableCell>
                <TableCell>{c.scope === "global" ? "Global" : c.storeName}</TableCell>
                <TableCell>{c.discountType === "percent" ? `${c.discountValue}%` : formatCurrency(c.discountValue)}</TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {c.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => setStatus(c.id, "approved")} disabled={moderate.isPending}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus(c.id, "rejected")} disabled={moderate.isPending}>Reject</Button>
                    </>
                  )}
                  {c.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "archived")} disabled={moderate.isPending}>Archive</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No coupons yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New global coupon</DialogTitle>
            <DialogDescription>Valid across all stores; live immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-1">
                  {(["percent", "fixed"] as const).map((t) => (
                    <button key={t} type="button"
                      className={`rounded-md border px-2 py-1.5 text-sm ${form.discountType === t ? "border-primary bg-primary/5 font-semibold" : ""}`}
                      onClick={() => setForm({ ...form, discountType: t })}>
                      {t === "percent" ? "% off" : "৳ off"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Min order (৳)</Label><Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max uses (0 = ∞)</Label><Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Starts</Label><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Creating..." : "Create coupon"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
