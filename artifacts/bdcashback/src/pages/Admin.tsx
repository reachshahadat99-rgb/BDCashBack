import { useState } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, Store, Ticket, Flame, Users, Gift, Percent, Plus,
  Wallet, ShoppingBag, Clock, FileText,
} from "lucide-react";
import {
  useGetAdminMe,
  useClaimAdmin,
  useListAdminMerchants,
  useUpdateAdminMerchant,
  useListAdminCoupons,
  useCreateAdminCoupon,
  useModerateAdminCoupon,
  useListAdminDeals,
  useModerateAdminDeal,
  useListAdminGroupBuys,
  useModerateAdminGroupBuy,
  useListAdminGiftCardBrands,
  useCreateAdminGiftCardBrand,
  useCreateAdminGiftCard,
  useUpdateAdminGiftCard,
  useListAdminGiftCardOrders,
  useListAdminFeeRules,
  useCreateAdminFeeRule,
  useUpdateAdminFeeRule,
  useListMarketplaceCategories,
  useListAdminWithdrawals,
  useActionAdminWithdrawal,
  useListAdminWalletTransactions,
  useListAdminOrders,
  useActionAdminOrder,
  useListAdminCashbackQueue,
  useListAdminAuditLogs,
  getGetAdminMeQueryKey,
  getListAdminMerchantsQueryKey,
  getListAdminCouponsQueryKey,
  getListAdminDealsQueryKey,
  getListAdminGroupBuysQueryKey,
  getListAdminGiftCardBrandsQueryKey,
  getListAdminFeeRulesQueryKey,
  getListAdminWithdrawalsQueryKey,
  getListAdminOrdersQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    active: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-red-100 text-red-700",
    archived: "bg-slate-100 text-slate-600",
  };
  return (
    <Badge className={`${map[status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>
      {status}
    </Badge>
  );
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(d),
  );
}

function MerchantsTab() {
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

function CouponsTab() {
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

function DealsTab() {
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

function GroupBuysTab() {
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

function GiftCardsTab() {
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

function FeeRulesTab() {
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

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const { data: withdrawals, isLoading: wLoading } = useListAdminWithdrawals();
  const { data: txns, isLoading: tLoading } = useListAdminWalletTransactions({ limit: 50 });
  const action = useActionAdminWithdrawal();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: getListAdminWithdrawalsQueryKey() });

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

function AdminOrdersTab() {
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

function CashbackQueueTab() {
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

function AuditLogsTab() {
  const { data, isLoading } = useListAdminAuditLogs({ limit: 100 });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const actionColor = (action: string) => {
    if (action.includes("reject") || action.includes("cancel")) return "bg-red-100 text-red-700";
    if (action.includes("approve") || action.includes("complete")) return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>
          <TableHead>Details</TableHead><TableHead>Date</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-mono text-xs">{log.adminUserId.slice(0, 12)}…</TableCell>
              <TableCell>
                <Badge className={`${actionColor(log.action)} border-none text-xs`}>{log.action}</Badge>
              </TableCell>
              <TableCell className="text-xs">
                <span className="text-muted-foreground">{log.targetType}/</span>
                <span className="font-mono">{log.targetId.slice(0, 8)}…</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
              <TableCell className="text-xs">{fmtDate(log.createdAt)}</TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit log entries yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

export default function Admin() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetAdminMe({
    query: {
      queryKey: getGetAdminMeQueryKey(),
      enabled: Boolean(isLoaded && isSignedIn),
      retry: false,
    },
  });
  const claim = useClaimAdmin();

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <div className="container mx-auto px-4 py-10"><Skeleton className="h-64 rounded-xl" /></div>;
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        <p className="text-muted-foreground">Sign in to access platform administration.</p>
        <Link href="/sign-in"><Button>Sign in</Button></Link>
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        {me?.canClaim ? (
          <>
            <p className="text-muted-foreground max-w-md mx-auto">
              No administrator exists yet. As the first user, you can claim the admin seat for this platform.
            </p>
            <Button
              disabled={claim.isPending}
              onClick={() =>
                claim.mutate(undefined, {
                  onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetAdminMeQueryKey() }),
                })
              }
            >
              {claim.isPending ? "Claiming..." : "Claim admin access"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">You don't have admin access to this platform.</p>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-6 animate-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2">
          <ShieldCheck className="w-4 h-4" /> Platform Admin
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Admin panel</h1>
        <p className="text-muted-foreground mt-1">Moderate merchants, promotions, gift cards and fee rules.</p>
      </div>

      <Tabs defaultValue="withdrawals">
        <TabsList className="flex-wrap h-auto gap-y-1">
          <TabsTrigger value="withdrawals" className="gap-1.5"><Wallet className="w-4 h-4" /> Withdrawals</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingBag className="w-4 h-4" /> Orders</TabsTrigger>
          <TabsTrigger value="cashback" className="gap-1.5"><Clock className="w-4 h-4" /> Cashback Queue</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><FileText className="w-4 h-4" /> Audit Logs</TabsTrigger>
          <TabsTrigger value="merchants" className="gap-1.5"><Store className="w-4 h-4" /> Merchants</TabsTrigger>
          <TabsTrigger value="coupons" className="gap-1.5"><Ticket className="w-4 h-4" /> Coupons</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><Flame className="w-4 h-4" /> Deals</TabsTrigger>
          <TabsTrigger value="group-buys" className="gap-1.5"><Users className="w-4 h-4" /> Group Buys</TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-1.5"><Gift className="w-4 h-4" /> Gift Cards</TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5"><Percent className="w-4 h-4" /> Fee Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="withdrawals" className="mt-4"><WithdrawalsTab /></TabsContent>
        <TabsContent value="orders" className="mt-4"><AdminOrdersTab /></TabsContent>
        <TabsContent value="cashback" className="mt-4"><CashbackQueueTab /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditLogsTab /></TabsContent>
        <TabsContent value="merchants" className="mt-4"><MerchantsTab /></TabsContent>
        <TabsContent value="coupons" className="mt-4"><CouponsTab /></TabsContent>
        <TabsContent value="deals" className="mt-4"><DealsTab /></TabsContent>
        <TabsContent value="group-buys" className="mt-4"><GroupBuysTab /></TabsContent>
        <TabsContent value="gift-cards" className="mt-4"><GiftCardsTab /></TabsContent>
        <TabsContent value="fees" className="mt-4"><FeeRulesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
