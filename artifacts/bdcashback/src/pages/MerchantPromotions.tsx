import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Ticket, Flame, Users } from "lucide-react";
import {
  useGetMerchantStore,
  useListMerchantCoupons,
  useCreateMerchantCoupon,
  useListMerchantDeals,
  useCreateMerchantDeal,
  useListMerchantGroupBuys,
  useCreateMerchantGroupBuy,
  getGetMerchantStoreQueryKey,
  getListMerchantCouponsQueryKey,
  getListMerchantDealsQueryKey,
  getListMerchantGroupBuysQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
    archived: "bg-slate-100 text-slate-600",
  };
  return (
    <Badge className={`${map[status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>
      {status}
    </Badge>
  );
}

function errMessage(err: unknown, fallback: string) {
  return err && typeof err === "object" && "error" in err && typeof err.error === "string"
    ? err.error
    : fallback;
}

function toIso(dateInput: string) {
  return new Date(dateInput).toISOString();
}

function CouponsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMerchantCoupons();
  const create = useCreateMerchantCoupon();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    title: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "10",
    minOrderValue: "0",
    maxUses: "0",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
  });

  function submit() {
    setError(null);
    if (!form.code.trim() || !form.title.trim() || !form.endsAt) {
      setError("Code, title and end date are required.");
      return;
    }
    create.mutate(
      {
        data: {
          code: form.code.trim().toUpperCase(),
          title: form.title.trim(),
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minOrderValue: Number(form.minOrderValue) || 0,
          maxUses: Number(form.maxUses) || 0,
          startsAt: toIso(form.startsAt),
          endsAt: toIso(form.endsAt),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          void queryClient.invalidateQueries({ queryKey: getListMerchantCouponsQueryKey() });
        },
        onError: (err) => setError(errMessage(err, "Could not create the coupon.")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New coupon
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No coupons yet. Create one — it goes live once an admin approves it.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((c) => (
            <Card key={c.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-primary">{c.code}</span>
                <span className="text-sm font-medium flex-1 min-w-32">{c.title}</span>
                <span className="text-sm text-muted-foreground">
                  {c.discountType === "percent" ? `${c.discountValue}% off` : `${formatCurrency(c.discountValue)} off`}
                  {c.minOrderValue > 0 && ` · min ${formatCurrency(c.minOrderValue)}`}
                  {c.maxUses > 0 && ` · ${c.usedCount}/${c.maxUses} used`}
                </span>
                {statusBadge(c.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New coupon</DialogTitle>
            <DialogDescription>Submitted for admin approval before going live.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={form.code} placeholder="SAVE20" onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} placeholder="Summer sale" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
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
              <div className="space-y-1">
                <Label>Value</Label>
                <Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Min order (৳, 0 = none)</Label>
                <Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Max uses (0 = unlimited)</Label>
                <Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Starts</Label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ends</Label>
                <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Submit for approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMerchantDeals();
  const create = useCreateMerchantDeal();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    discountPercent: "10",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
  });

  function submit() {
    setError(null);
    if (!form.title.trim() || !form.endsAt) {
      setError("Title and end date are required.");
      return;
    }
    create.mutate(
      {
        data: {
          title: form.title.trim(),
          description: form.description.trim(),
          discountPercent: Number(form.discountPercent),
          startsAt: toIso(form.startsAt),
          endsAt: toIso(form.endsAt),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          void queryClient.invalidateQueries({ queryKey: getListMerchantDealsQueryKey() });
        },
        onError: (err) => setError(errMessage(err, "Could not create the deal.")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New deal
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No promotional deals yet. Launch one — it appears on the Deals page after approval.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((d) => (
            <Card key={d.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="font-black text-red-600">-{Math.round(d.discountPercent)}%</span>
                <span className="text-sm font-medium flex-1 min-w-32">{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  Ends {new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(new Date(d.endsAt))}
                </span>
                {d.featured && <Badge className="bg-yellow-100 text-yellow-700 border-none">Featured</Badge>}
                {statusBadge(d.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New promotional deal</DialogTitle>
            <DialogDescription>Submitted for admin approval before going live.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} placeholder="Mid-season blowout" onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description} placeholder="What's on offer?" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Discount %</Label>
                <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Starts</Label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ends</Label>
                <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Submit for approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupBuysTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMerchantGroupBuys();
  const create = useCreateMerchantGroupBuy();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    image: "",
    originalPrice: "",
    groupPrice: "",
    cashbackPercent: "5",
    depositPercent: "20",
    minParticipants: "5",
    endsAt: "",
  });

  function submit() {
    setError(null);
    if (!form.title.trim() || !form.category.trim() || !form.endsAt || !form.originalPrice || !form.groupPrice) {
      setError("Title, category, prices and end date are required.");
      return;
    }
    create.mutate(
      {
        data: {
          title: form.title.trim(),
          category: form.category.trim(),
          image: form.image.trim() || undefined,
          originalPrice: Number(form.originalPrice),
          groupPrice: Number(form.groupPrice),
          cashbackPercent: Number(form.cashbackPercent),
          depositPercent: Number(form.depositPercent),
          minParticipants: Number(form.minParticipants),
          endsAt: toIso(form.endsAt),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          void queryClient.invalidateQueries({ queryKey: getListMerchantGroupBuysQueryKey() });
        },
        onError: (err) => setError(errMessage(err, "Could not create the campaign.")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New campaign
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No group buy campaigns yet. Launch one to pool customer demand at a group price.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((g) => (
            <Card key={g.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium flex-1 min-w-32">{g.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(g.groupPrice)} <s className="text-xs">{formatCurrency(g.originalPrice)}</s>
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {g.joinedCount}/{g.minParticipants}
                </span>
                <span className="text-xs text-muted-foreground">
                  Deposits {formatCurrency(g.depositCollected)}
                </span>
                {statusBadge(g.approvalStatus)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New group buy campaign</DialogTitle>
            <DialogDescription>Submitted for admin approval before going live.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input value={form.category} placeholder="Electronics" onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Image URL (optional)</Label>
              <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Original price (৳)</Label>
                <Input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Group price (৳)</Label>
                <Input type="number" value={form.groupPrice} onChange={(e) => setForm({ ...form, groupPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Cashback %</Label>
                <Input type="number" value={form.cashbackPercent} onChange={(e) => setForm({ ...form, cashbackPercent: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Deposit %</Label>
                <Input type="number" value={form.depositPercent} onChange={(e) => setForm({ ...form, depositPercent: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Min buyers</Label>
                <Input type="number" value={form.minParticipants} onChange={(e) => setForm({ ...form, minParticipants: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Ends</Label>
              <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Submit for approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MerchantPromotions() {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: store, isLoading } = useGetMerchantStore({
    query: {
      queryKey: getGetMerchantStoreQueryKey(),
      enabled: Boolean(isLoaded && isSignedIn),
      retry: false,
    },
  });

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!isSignedIn || !store) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-extrabold">Merchant promotions</h1>
        <p className="text-muted-foreground">
          {!isSignedIn
            ? "Sign in with your merchant account to manage promotions."
            : "Create your store first to launch coupons, deals and group buys."}
        </p>
        <Link href={!isSignedIn ? "/sign-in" : "/merchant"}>
          <Button>{!isSignedIn ? "Sign in" : "Go to merchant dashboard"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-6 animate-in">
      <div>
        <Link href="/merchant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Merchant dashboard
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2">Promotions</h1>
        <p className="text-muted-foreground mt-1">
          Coupons, deals and group buy campaigns for {store.name}. New items need admin approval.
        </p>
      </div>

      <Tabs defaultValue="coupons">
        <TabsList>
          <TabsTrigger value="coupons" className="gap-1.5"><Ticket className="w-4 h-4" /> Coupons</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><Flame className="w-4 h-4" /> Deals</TabsTrigger>
          <TabsTrigger value="group-buys" className="gap-1.5"><Users className="w-4 h-4" /> Group Buys</TabsTrigger>
        </TabsList>
        <TabsContent value="coupons" className="mt-4"><CouponsTab /></TabsContent>
        <TabsContent value="deals" className="mt-4"><DealsTab /></TabsContent>
        <TabsContent value="group-buys" className="mt-4"><GroupBuysTab /></TabsContent>
      </Tabs>
    </div>
  );
}
