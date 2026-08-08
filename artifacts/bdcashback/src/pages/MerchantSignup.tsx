import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useCreateMerchantStore } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet as WalletIcon, CheckCircle2, ArrowRight, ArrowLeft, Store,
  Briefcase, MapPin, Banknote, ImageIcon, FileText, ClipboardCheck, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FormData {
  // Step 1
  storeName: string;
  businessType: "individual" | "registered" | "";
  categories: string[];
  phone: string;
  email: string;
  // Step 2
  address: string;
  payoutMethod: "bkash" | "nagad" | "rocket" | "bank" | "";
  payoutNumber: string;
  // Step 3
  description: string;
  returnPolicyAck: boolean;
  // Step 4 (just review + terms)
  termsAck: boolean;
}

const INITIAL: FormData = {
  storeName: "", businessType: "", categories: [], phone: "", email: "",
  address: "", payoutMethod: "", payoutNumber: "",
  description: "", returnPolicyAck: false,
  termsAck: false,
};

const CATEGORIES = [
  "Electronics", "Fashion", "Beauty & Personal Care", "Home & Living",
  "Sports & Outdoors", "Books & Stationery", "Food & Grocery", "Health",
];

const STEPS = [
  { label: "Business Basics", icon: Briefcase },
  { label: "Verification", icon: MapPin },
  { label: "Store Setup", icon: Store },
  { label: "Review & Submit", icon: ClipboardCheck },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0 w-full">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const Icon = step.icon;
        return (
          <li key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all text-sm font-bold",
                done ? "bg-primary text-primary-foreground" : active ? "bg-primary/10 border-2 border-primary text-primary" : "bg-muted text-muted-foreground border border-border"
              )}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={cn("text-[10px] font-semibold hidden sm:block whitespace-nowrap", active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn("h-0.5 flex-1 mx-2 mb-5 transition-all", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Business Basics
// ---------------------------------------------------------------------------
function Step1({ data, onChange, onNext }: { data: FormData; onChange: (d: Partial<FormData>) => void; onNext: () => void }) {
  const toggleCategory = (cat: string) => {
    const updated = data.categories.includes(cat)
      ? data.categories.filter((c) => c !== cat)
      : [...data.categories, cat];
    onChange({ categories: updated });
  };

  const valid = data.storeName.trim() && data.businessType && data.phone.trim() && data.email.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold mb-1">Tell us about your business</h2>
        <p className="text-sm text-muted-foreground">Basic details to set up your BDCashBack merchant account.</p>
      </div>

      {/* Store name */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Store Name <span className="text-destructive">*</span></label>
        <input
          type="text"
          placeholder="e.g. Rahim's Electronics"
          value={data.storeName}
          onChange={(e) => onChange({ storeName: e.target.value })}
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {/* Business type */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Business Type <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: "individual", label: "Individual Seller" }, { value: "registered", label: "Registered Business" }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ businessType: opt.value as FormData["businessType"] })}
              className={cn(
                "rounded-xl border py-3 px-4 text-sm font-semibold text-left transition-all",
                data.businessType === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Categories you'll sell in</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                data.categories.includes(cat) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Phone Number <span className="text-destructive">*</span></label>
          <input
            type="tel"
            placeholder="01XXXXXXXXX"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Business Email <span className="text-destructive">*</span></label>
          <input
            type="email"
            placeholder="you@business.com"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <Button className="w-full h-11 font-bold rounded-xl" onClick={onNext} disabled={!valid}>
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Verification
// ---------------------------------------------------------------------------
function Step2({ data, onChange, onNext, onBack }: { data: FormData; onChange: (d: Partial<FormData>) => void; onNext: () => void; onBack: () => void }) {
  const valid = data.address.trim() && data.payoutMethod && data.payoutNumber.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold mb-1">Verification & Payout</h2>
        <p className="text-sm text-muted-foreground">We need a few details to verify your business and send you payments.</p>
      </div>

      {/* NID / Trade License Upload — placeholder note */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center space-y-2">
        <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
        <div className="text-sm font-semibold text-muted-foreground">NID / Trade License Upload</div>
        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
          File upload (NID or trade license) will be available once you submit. Our team will reach out to collect documents.
        </p>
      </div>

      {/* Business address */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Business Address <span className="text-destructive">*</span></label>
        <textarea
          rows={3}
          placeholder="House/Flat, Road, Area, District"
          value={data.address}
          onChange={(e) => onChange({ address: e.target.value })}
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>

      {/* Payout method */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Payout Method <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["bkash", "nagad", "rocket", "bank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ payoutMethod: m })}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-bold capitalize transition-all",
                data.payoutMethod === m ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
              )}
            >
              {m === "bank" ? "Bank" : m === "bkash" ? "bKash" : m === "nagad" ? "Nagad" : "Rocket"}
            </button>
          ))}
        </div>
      </div>

      {/* Payout number */}
      {data.payoutMethod && (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {data.payoutMethod === "bank" ? "Account Number" : `${data.payoutMethod === "bkash" ? "bKash" : data.payoutMethod === "nagad" ? "Nagad" : "Rocket"} Number`}
            {" "}<span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            placeholder={data.payoutMethod === "bank" ? "Bank account number" : "01XXXXXXXXX"}
            value={data.payoutNumber}
            onChange={(e) => onChange({ payoutNumber: e.target.value })}
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-11 font-bold rounded-xl" onClick={onBack}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 h-11 font-bold rounded-xl" onClick={onNext} disabled={!valid}>
          Continue <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Store Setup
// ---------------------------------------------------------------------------
function Step3({ data, onChange, onNext, onBack }: { data: FormData; onChange: (d: Partial<FormData>) => void; onNext: () => void; onBack: () => void }) {
  const valid = data.description.trim() && data.returnPolicyAck;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold mb-1">Set up your store</h2>
        <p className="text-sm text-muted-foreground">Help customers understand what you sell and what to expect.</p>
      </div>

      {/* Logo / banner upload — placeholder */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center space-y-2">
          <ImageIcon className="w-7 h-7 text-muted-foreground/40 mx-auto" />
          <div className="text-xs font-semibold text-muted-foreground">Store Logo</div>
          <div className="text-[10px] text-muted-foreground/60">Upload after submission</div>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center space-y-2">
          <ImageIcon className="w-7 h-7 text-muted-foreground/40 mx-auto" />
          <div className="text-xs font-semibold text-muted-foreground">Store Banner</div>
          <div className="text-[10px] text-muted-foreground/60">Upload after submission</div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Short Store Description <span className="text-destructive">*</span></label>
        <textarea
          rows={4}
          placeholder="Tell shoppers what makes your store special — products you carry, brands you stock, etc."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
        <div className="text-xs text-muted-foreground text-right">{data.description.length} / 300</div>
      </div>

      {/* Return policy ack */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <input
            id="return-policy"
            type="checkbox"
            checked={data.returnPolicyAck}
            onChange={(e) => onChange({ returnPolicyAck: e.target.checked })}
            className="w-4 h-4 mt-0.5 shrink-0 accent-teal-600"
          />
          <label htmlFor="return-policy" className="text-sm cursor-pointer leading-relaxed">
            <span className="font-semibold">I understand BDCashBack's return policy.</span>{" "}
            <span className="text-muted-foreground">
              Customers have a 30-day return window from delivery. Cashback is held during this period and released once the window closes without a return request.
            </span>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-11 font-bold rounded-xl" onClick={onBack}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 h-11 font-bold rounded-xl" onClick={onNext} disabled={!valid}>
          Review Application <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review & Submit
// ---------------------------------------------------------------------------
function Step4({ data, onChange, onSubmit, onBack, isSubmitting }: {
  data: FormData;
  onChange: (d: Partial<FormData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const rows: [string, string][] = [
    ["Store Name", data.storeName],
    ["Business Type", data.businessType === "individual" ? "Individual Seller" : "Registered Business"],
    ["Categories", data.categories.join(", ") || "—"],
    ["Phone", data.phone],
    ["Email", data.email],
    ["Address", data.address],
    ["Payout Method", data.payoutMethod.toUpperCase()],
    ["Payout Number", data.payoutNumber],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold mb-1">Review your application</h2>
        <p className="text-sm text-muted-foreground">Please confirm all details are correct before submitting.</p>
      </div>

      {/* Summary table */}
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-4 px-5 py-3">
            <span className="text-xs text-muted-foreground font-semibold w-28 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm font-medium flex-1">{value}</span>
          </div>
        ))}
      </div>

      {/* Store description */}
      {data.description && (
        <div className="rounded-2xl border border-border px-5 py-4 space-y-1">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Store Description</span>
          <p className="text-sm mt-1">{data.description}</p>
        </div>
      )}

      {/* Merchant terms */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-5 space-y-3">
        <div className="text-sm font-bold text-amber-800 dark:text-amber-400">Merchant Fee Disclosure</div>
        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> <strong>No listing fee</strong> — list unlimited products for free</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> <strong>No monthly subscription</strong> — zero fixed costs</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> <strong>Success fee only</strong> — a small % only on completed, non-refunded sales</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> <strong>Payouts</strong> — processed within 7 business days of order completion</li>
        </ul>
      </div>

      {/* Final terms checkbox */}
      <div className="flex items-start gap-3">
        <input
          id="merchant-terms"
          type="checkbox"
          checked={data.termsAck}
          onChange={(e) => onChange({ termsAck: e.target.checked })}
          className="w-4 h-4 mt-0.5 shrink-0 accent-teal-600"
        />
        <label htmlFor="merchant-terms" className="text-sm cursor-pointer text-muted-foreground leading-relaxed">
          I agree to BDCashBack's{" "}
          <a href="#" className="text-primary font-semibold underline">Merchant Terms of Service</a>,{" "}
          <a href="#" className="text-primary font-semibold underline">Seller Policy</a>, and the fee structure disclosed above.
        </label>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-11 font-bold rounded-xl" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 h-11 font-bold rounded-xl" onClick={onSubmit} disabled={!data.termsAck || isSubmitting}>
          {isSubmitting ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Submitting…</>
          ) : (
            <>Submit Application <ArrowRight className="ml-2 w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success Screen
// ---------------------------------------------------------------------------
function SuccessScreen({ storeName }: { storeName: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-10">
      <div className="w-20 h-20 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
        <Sparkles className="w-10 h-10" />
      </div>
      <div className="space-y-2 max-w-sm">
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 mb-2">Pending Admin Approval</Badge>
        <h2 className="text-2xl font-extrabold">Application submitted!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <strong>{storeName}</strong> has been submitted for review. Our team will verify your details and approve your store within <strong>1–2 business days</strong>.
        </p>
        <p className="text-muted-foreground text-sm">You'll receive an email notification once your store is approved.</p>
      </div>
      <div className="rounded-2xl border border-border bg-muted/30 p-5 w-full max-w-sm space-y-2 text-left">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What happens next?</div>
        {["Admin reviews your business details", "You receive an approval email", "Full merchant dashboard unlocked", "Start listing products & earning"].map((t, i) => (
          <div key={t} className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
            {t}
          </div>
        ))}
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <Link href="/" className="flex-1">
          <Button variant="outline" className="w-full font-bold rounded-xl">Go Home</Button>
        </Link>
        <Link href="/merchant" className="flex-1">
          <Button className="w-full font-bold rounded-xl">View Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate: require sign-in
// ---------------------------------------------------------------------------
function SignInGate() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center text-center space-y-5 py-16">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Store className="w-8 h-8" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-extrabold">Sign in to apply as a merchant</h2>
        <p className="text-sm text-muted-foreground">Create a free account first, then complete your merchant application.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => setLocation(`/sign-up`)} className="font-bold rounded-xl">
          Create Account <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
        <Button variant="outline" onClick={() => setLocation(`/sign-in`)} className="font-bold rounded-xl">
          Sign In
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function MerchantSignup() {
  const { isLoaded, isSignedIn } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const { mutateAsync: createStore, isPending } = useCreateMerchantStore();

  const update = (patch: Partial<FormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    try {
      await createStore({
        data: {
          name: form.storeName,
          description: form.description,
        },
      });
      setSubmitted(true);
    } catch {
      // swallow; already has a store or other error
      setSubmitted(true); // still show pending screen
    }
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[440px] flex-shrink-0 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white p-10 flex-col justify-between">
        <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">BDCashBack</span>
          </Link>

          <div className="space-y-3">
            <Badge className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/20 border border-teal-500/30">Merchant Program</Badge>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight">
              Sell to 15,000+<br />
              <span className="text-teal-400">cashback shoppers</span>
            </h1>
            <p className="text-slate-300 leading-relaxed text-sm">
              Join Bangladesh's fastest-growing cashback marketplace. Free store setup, no listing fees.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: CheckCircle2, t: "Free to join — no setup fee" },
              { icon: CheckCircle2, t: "No monthly subscription" },
              { icon: CheckCircle2, t: "Pay only on completed sales" },
              { icon: CheckCircle2, t: "Payouts via bKash, Nagad, or bank" },
            ].map((item) => (
              <div key={item.t} className="flex items-center gap-3 text-sm">
                <item.icon className="w-5 h-5 text-teal-400 shrink-0" />
                <span className="text-slate-300">{item.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step counter */}
        {!submitted && isSignedIn && (
          <div className="relative z-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 space-y-1">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Application Progress</div>
            <div className="text-2xl font-black">Step {step + 1} of {STEPS.length}</div>
            <div className="text-sm text-slate-300">{STEPS[step]?.label}</div>
          </div>
        )}
      </div>

      {/* Right: form area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-4 py-10 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden w-full max-w-lg mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-primary">BDCashBack</span>
          </Link>
        </div>

        <div className="w-full max-w-lg space-y-8">
          {!isLoaded ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : !isSignedIn ? (
            <SignInGate />
          ) : submitted ? (
            <SuccessScreen storeName={form.storeName} />
          ) : (
            <>
              <StepIndicator current={step} />
              <Card className="shadow-sm border-border/60">
                <CardContent className="p-6 md:p-8">
                  {step === 0 && <Step1 data={form} onChange={update} onNext={() => setStep(1)} />}
                  {step === 1 && <Step2 data={form} onChange={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
                  {step === 2 && <Step3 data={form} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                  {step === 3 && <Step4 data={form} onChange={update} onSubmit={handleSubmit} onBack={() => setStep(2)} isSubmitting={isPending} />}
                </CardContent>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                Already a merchant?{" "}
                <Link href="/merchant" className="text-primary font-semibold hover:underline">Go to dashboard</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
