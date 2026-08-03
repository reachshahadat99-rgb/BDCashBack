import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useListAdminMerchants,
  useUpdateAdminMerchant,
  getListAdminMerchantsQueryKey,
} from "@workspace/api-client-react";
import { fmtDate } from "@/lib/utils";
import { statusBadge } from "./admin-helpers";

export default function MerchantsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminMerchants();
  const update = useUpdateAdminMerchant();

  function setStatus(id: string, status: "active" | "suspended") {
    update.mutate(
      { id, data: { status } },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListAdminMerchantsQueryKey() }) },
    );
  }

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Store</TableHead><TableHead>Products</TableHead>
          <TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.productCount}</TableCell>
              <TableCell>{fmtDate(m.createdAt)}</TableCell>
              <TableCell>{statusBadge(m.status)}</TableCell>
              <TableCell className="text-right">
                {m.status === "suspended" ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "active")} disabled={update.isPending}>Reinstate</Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => setStatus(m.id, "suspended")} disabled={update.isPending}>Suspend</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No merchant stores yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
