import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminGroupBuys,
  useModerateAdminGroupBuy,
  getListAdminGroupBuysQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { statusBadge } from "./admin-helpers";

export default function GroupBuysTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminGroupBuys();
  const moderate = useModerateAdminGroupBuy();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminGroupBuysQueryKey() });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Campaign</TableHead><TableHead>Price</TableHead><TableHead>Joined</TableHead>
          <TableHead>Deposits</TableHead><TableHead>Approval</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.title}</TableCell>
              <TableCell>{formatCurrency(g.groupPrice)} <s className="text-xs text-muted-foreground">{formatCurrency(g.originalPrice)}</s></TableCell>
              <TableCell>{g.joinedCount}/{g.minParticipants}</TableCell>
              <TableCell>{formatCurrency(g.depositCollected)}</TableCell>
              <TableCell>{statusBadge(g.approvalStatus)}</TableCell>
              <TableCell className="text-right space-x-1">
                {g.approvalStatus === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => moderate.mutate({ id: g.id, data: { status: "approved" } }, { onSuccess: invalidate })} disabled={moderate.isPending}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => moderate.mutate({ id: g.id, data: { status: "rejected" } }, { onSuccess: invalidate })} disabled={moderate.isPending}>Reject</Button>
                  </>
                ) : g.approvalStatus === "approved" ? (
                  <Button size="sm" variant="destructive" onClick={() => moderate.mutate({ id: g.id, data: { status: "rejected" } }, { onSuccess: invalidate })} disabled={moderate.isPending}>Pull down</Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No group buy campaigns yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
