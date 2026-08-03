import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminWithdrawals,
  useActionAdminWithdrawal,
  useListAdminWalletTransactions,
  getListAdminWithdrawalsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, fmtDate } from "@/lib/utils";

export default function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const { data: withdrawals, isLoading: wLoading } = useListAdminWithdrawals();
  const { data: txns, isLoading: tLoading } = useListAdminWalletTransactions({ limit: 50 });
  const action = useActionAdminWithdrawal();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminWithdrawalsQueryKey() });

  function act(id: string, act2: "approve" | "reject" | "process") {
    action.mutate({ id, data: { action: act2 } }, { onSuccess: invalidate });
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold mb-2">Withdrawal requests</h3>
        {wLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Bank</TableHead>
                <TableHead>Account</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {(withdrawals ?? []).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.userId.slice(0, 12)}…</TableCell>
                    <TableCell className="font-bold">{formatCurrency(w.amount)}</TableCell>
                    <TableCell>{w.bankName}</TableCell>
                    <TableCell className="font-mono text-xs">{w.accountNumber}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[w.status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>{w.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => act(w.id, "approve")} disabled={action.isPending}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => act(w.id, "reject")} disabled={action.isPending}>Reject</Button>
                        </>
                      )}
                      {w.status === "processing" && (
                        <Button size="sm" variant="outline" onClick={() => act(w.id, "process")} disabled={action.isPending}>Mark processed</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(withdrawals ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No withdrawal requests.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      <div>
        <h3 className="font-bold mb-2">Recent wallet transactions (all users)</h3>
        {tLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead>
                <TableHead>Description</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(txns ?? []).slice(0, 30).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.userId.slice(0, 12)}…</TableCell>
                    <TableCell><Badge className="bg-slate-100 text-slate-700 border-none text-xs capitalize">{t.type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className={`font-bold ${t.amount < 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(Math.abs(t.amount))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{t.description}</TableCell>
                    <TableCell className="text-xs">{fmtDate(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {(txns ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
