import { useState } from "react";
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
import AdminStoreView from "./AdminStoreView";
import { Store } from "lucide-react";

interface ManagedStore {
  id: string;
  name: string;
}

export default function MerchantsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminMerchants();
  const update = useUpdateAdminMerchant();
  const [managing, setManaging] = useState<ManagedStore | null>(null);

  function setStatus(id: string, status: "active" | "suspended") {
    update.mutate(
      { id, data: { status } },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListAdminMerchantsQueryKey() }) },
    );
  }

  // Show store management view when selected
  if (managing) {
    return (
      <AdminStoreView
        storeId={managing.id}
        storeName={managing.name}
        onBack={() => setManaging(null)}
      />
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
              <TableCell className="text-right space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setManaging({ id: m.id, name: m.name })}
                >
                  <Store className="w-3.5 h-3.5" /> Manage Store
                </Button>
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
