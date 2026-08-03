import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminDeals,
  useModerateAdminDeal,
  getListAdminDealsQueryKey,
} from "@workspace/api-client-react";
import { fmtDate } from "@/lib/utils";
import { statusBadge } from "./admin-helpers";

export default function DealsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminDeals();
  const moderate = useModerateAdminDeal();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminDealsQueryKey() });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Deal</TableHead><TableHead>Store</TableHead><TableHead>Discount</TableHead>
          <TableHead>Ends</TableHead><TableHead>Status</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.title}{d.featured && <Badge className="ml-2 bg-yellow-100 text-yellow-700 border-none">Featured</Badge>}</TableCell>
              <TableCell>{d.storeName}</TableCell>
              <TableCell>-{Math.round(d.discountPercent)}%</TableCell>
              <TableCell>{fmtDate(d.endsAt)}</TableCell>
              <TableCell>{statusBadge(d.status)}</TableCell>
              <TableCell className="text-right space-x-1">
                {d.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => moderate.mutate({ id: d.id, data: { status: "approved" } }, { onSuccess: invalidate })} disabled={moderate.isPending}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => moderate.mutate({ id: d.id, data: { status: "rejected" } }, { onSuccess: invalidate })} disabled={moderate.isPending}>Reject</Button>
                  </>
                )}
                {d.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: d.id, data: { featured: !d.featured } }, { onSuccess: invalidate })} disabled={moderate.isPending}>
                    {d.featured ? "Unfeature" : "Feature"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No deals yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
