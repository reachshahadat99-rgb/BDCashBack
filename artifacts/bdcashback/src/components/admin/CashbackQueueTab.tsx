import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListAdminCashbackQueue } from "@workspace/api-client-react";
import { formatCurrency, fmtDate } from "@/lib/utils";

export default function CashbackQueueTab() {
  const { data, isLoading } = useListAdminCashbackQueue();

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const total = (data ?? []).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border bg-green-50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Total pending</p>
          <p className="text-xl font-extrabold text-green-700">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="text-xl font-extrabold">{(data ?? []).length}</p>
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead>
            <TableHead>Description</TableHead><TableHead>Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.userId.slice(0, 12)}…</TableCell>
                <TableCell className="font-bold text-green-600">{formatCurrency(item.amount)}</TableCell>
                <TableCell>
                  <Badge className="bg-slate-100 text-slate-700 border-none text-xs capitalize">{item.referenceType?.replace(/_/g, " ") ?? "order"}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{item.description}</TableCell>
                <TableCell className="text-xs">{fmtDate(item.createdAt)}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No pending cashback.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">
        Pending cashback becomes available automatically after the return window closes (30 days from delivery). This queue refreshes as orders complete.
      </p>
    </div>
  );
}
