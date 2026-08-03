import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminOrders,
  useActionAdminOrder,
  getListAdminOrdersQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, fmtDate } from "@/lib/utils";

export default function AdminOrdersTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading } = useListAdminOrders(statusFilter ? { status: statusFilter } : undefined);
  const action = useActionAdminOrder();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });

  const STATUS_OPTIONS = ["", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"];

  function act(id: string, a: "cancel" | "force_complete", reason?: string) {
    action.mutate({ id, data: { action: a, reason } }, { onSuccess: invalidate });
  }

  const statusColors: Record<string, string> = {
    paid: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    shipped: "bg-indigo-100 text-indigo-700",
    delivered: "bg-teal-100 text-teal-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    refunded: "bg-slate-100 text-slate-700",
  };

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filter by status:</Label>
        <select
          className="h-8 rounded-md border bg-transparent px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
        </select>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order ID</TableHead><TableHead>User</TableHead><TableHead>Total</TableHead>
            <TableHead>Cashback</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 10)}…</TableCell>
                <TableCell className="font-mono text-xs">{o.userId.slice(0, 12)}…</TableCell>
                <TableCell className="font-bold">{formatCurrency(o.total)}</TableCell>
                <TableCell className="text-green-600">{formatCurrency(o.cashbackAmount)}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[o.status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{fmtDate(o.createdAt)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {["paid", "processing"].includes(o.status) && (
                    <Button size="sm" variant="destructive" onClick={() => act(o.id, "cancel", "Admin cancellation")} disabled={action.isPending}>Cancel</Button>
                  )}
                  {!["completed", "cancelled", "refunded"].includes(o.status) && (
                    <Button size="sm" variant="outline" onClick={() => act(o.id, "force_complete")} disabled={action.isPending}>Force complete</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
