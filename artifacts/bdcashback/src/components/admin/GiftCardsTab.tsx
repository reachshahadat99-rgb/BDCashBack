import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import {
  useListAdminGiftCardBrands,
  useCreateAdminGiftCardBrand,
  useCreateAdminGiftCard,
  useUpdateAdminGiftCard,
  useListAdminGiftCardOrders,
  getListAdminGiftCardBrandsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, fmtDate } from "@/lib/utils";

export default function GiftCardsTab() {
  const queryClient = useQueryClient();
  const { data: brands, isLoading } = useListAdminGiftCardBrands();
  const { data: orders } = useListAdminGiftCardOrders();
  const createBrand = useCreateAdminGiftCardBrand();
  const createCard = useCreateAdminGiftCard();
  const updateCard = useUpdateAdminGiftCard();
  const [brandName, setBrandName] = useState("");
  const [cardForm, setCardForm] = useState<{ brandId: string; faceValue: string; price: string; stock: string } | null>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListAdminGiftCardBrandsQueryKey() });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input placeholder="New brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="max-w-xs" />
        <Button
          disabled={!brandName.trim() || createBrand.isPending}
          onClick={() => createBrand.mutate({ data: { name: brandName.trim() } }, { onSuccess: () => { setBrandName(""); invalidate(); } })}
        >
          Add brand
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(brands ?? []).map((b) => (
          <Card key={b.id} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold">{b.name}</span>
                <Button size="sm" variant="outline" onClick={() => setCardForm({ brandId: b.id, faceValue: "1000", price: "950", stock: "50" })}>
                  <Plus className="w-3.5 h-3.5" /> Denomination
                </Button>
              </div>
              {b.cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No denominations yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {b.cards.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-1.5">
                      <span>{formatCurrency(c.faceValue)} for {formatCurrency(c.price)}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{c.stock} in stock</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updateCard.isPending}
                          onClick={() => updateCard.mutate({ id: c.id, data: { active: !c.active } }, { onSuccess: invalidate })}>
                          {c.active ? "Disable" : "Enable"}
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Recent purchases</h3>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Brand</TableHead><TableHead>Value</TableHead><TableHead>Paid</TableHead>
              <TableHead>Method</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(orders ?? []).slice(0, 10).map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.brandName}</TableCell>
                  <TableCell>{formatCurrency(o.faceValue)}</TableCell>
                  <TableCell>{formatCurrency(o.pricePaid)}</TableCell>
                  <TableCell className="capitalize">{o.paymentMethod}</TableCell>
                  <TableCell>{fmtDate(o.createdAt)}</TableCell>
                </TableRow>
              ))}
              {(orders ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No purchases yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={cardForm !== null} onOpenChange={(v) => !v && setCardForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New denomination</DialogTitle></DialogHeader>
          {cardForm && (
            <div className="grid gap-3">
              <div className="space-y-1"><Label>Face value (৳)</Label><Input type="number" value={cardForm.faceValue} onChange={(e) => setCardForm({ ...cardForm, faceValue: e.target.value })} /></div>
              <div className="space-y-1"><Label>Selling price (৳)</Label><Input type="number" value={cardForm.price} onChange={(e) => setCardForm({ ...cardForm, price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Stock</Label><Input type="number" value={cardForm.stock} onChange={(e) => setCardForm({ ...cardForm, stock: e.target.value })} /></div>
              <Button disabled={createCard.isPending} onClick={() =>
                createCard.mutate(
                  { data: { brandId: cardForm.brandId, faceValue: Number(cardForm.faceValue), price: Number(cardForm.price), stock: Number(cardForm.stock) } },
                  { onSuccess: () => { setCardForm(null); invalidate(); } },
                )}>
                {createCard.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
