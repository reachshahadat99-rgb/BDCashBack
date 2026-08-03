import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminFeeRules,
  useCreateAdminFeeRule,
  useUpdateAdminFeeRule,
  useListMarketplaceCategories,
  getListAdminFeeRulesQueryKey,
} from "@workspace/api-client-react";
import { statusBadge } from "./admin-helpers";

export default function FeeRulesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminFeeRules();
  const { data: categories } = useListMarketplaceCategories();
  const create = useCreateAdminFeeRule();
  const update = useUpdateAdminFeeRule();
  const [form, setForm] = useState({ categoryId: "", feePercent: "10", customerSharePercent: "50", returnPeriodDays: "7" });
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminFeeRulesQueryKey() });

  function submit() {
    setError(null);
    if (!form.categoryId) { setError("Pick a category."); return; }
    create.mutate(
      { data: { categoryId: form.categoryId, feePercent: Number(form.feePercent), customerSharePercent: Number(form.customerSharePercent), returnPeriodDays: Number(form.returnPeriodDays) } },
      {
        onSuccess: () => { setForm({ ...form, categoryId: "" }); invalidate(); },
        onError: (err: unknown) =>
          setError(err && typeof err === "object" && "error" in err && typeof err.error === "string" ? err.error : "Could not create the rule."),
      },
    );
  }

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  const usedCategoryIds = new Set((data ?? []).map((r) => r.categoryId));
  const available = (categories ?? []).filter((c) => !usedCategoryIds.has(c.id));

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
        <div className="space-y-1">
          <Label>Category</Label>
          <select className="h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Select...</option>
            {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>Success fee %</Label><Input type="number" value={form.feePercent} onChange={(e) => setForm({ ...form, feePercent: e.target.value })} /></div>
        <div className="space-y-1"><Label>Customer share %</Label><Input type="number" value={form.customerSharePercent} onChange={(e) => setForm({ ...form, customerSharePercent: e.target.value })} /></div>
        <div className="space-y-1"><Label>Return period (days)</Label><Input type="number" value={form.returnPeriodDays} onChange={(e) => setForm({ ...form, returnPeriodDays: e.target.value })} /></div>
        <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Adding..." : "Add rule"}</Button>
        {error && <p className="text-sm text-destructive md:col-span-5">{error}</p>}
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Category</TableHead><TableHead>Success fee</TableHead><TableHead>Customer share</TableHead>
            <TableHead>Return period</TableHead><TableHead>Active</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.categoryName}</TableCell>
                <TableCell>{r.feePercent}%</TableCell>
                <TableCell>{r.customerSharePercent}%</TableCell>
                <TableCell>{r.returnPeriodDays} days</TableCell>
                <TableCell>{r.active ? statusBadge("active") : statusBadge("archived")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={update.isPending}
                    onClick={() => update.mutate({ id: r.id, data: { active: !r.active } }, { onSuccess: invalidate })}>
                    {r.active ? "Deactivate" : "Activate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No fee rules configured yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">
        Fee rules define the marketplace success fee per category and how much of it is shared back to customers as cashback. The billing engine reads these rules when orders complete.
      </p>
    </div>
  );
}
