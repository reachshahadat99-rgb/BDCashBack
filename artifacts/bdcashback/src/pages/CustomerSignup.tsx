import { Link } from "wouter";
import { CheckCircle2, Wallet as WalletIcon, BadgePercent, Banknote, ShoppingBag } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";

const BENEFITS = [
  { icon: ShoppingBag, title: "Shop 1,000+ products", desc: "From verified merchants across all categories." },
  { icon: BadgePercent, title: "Earn cashback every order", desc: "Automatic cashback on every purchase — no codes needed." },
  { icon: Banknote, title: "Withdraw to bKash or bank", desc: "Transfer your earned cashback anytime, zero fees." },
];

export default function CustomerSignup() {
  return (
    <div className="min-h-[100dvh] flex">
      {/* Left: branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-shrink-0 relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 text-white p-10 flex-col justify-between">
        <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-400/30 rounded-full blur-2xl" />

        <div className="relative z-10 space-y-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight">BDCashBack</span>
          </Link>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
              ✨ Join 15,000+ smart shoppers
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
              Start earning<br />
              <span className="text-yellow-300">cashback today</span>
            </h1>
            <p className="text-teal-100 text-lg leading-relaxed">
              Create your free account and turn every purchase into real money back.
            </p>
          </div>

          <div className="space-y-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 mt-0.5">
                  <b.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">{b.title}</div>
                  <div className="text-teal-200 text-xs mt-0.5">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 space-y-2">
          <p className="text-sm text-teal-100 italic">
            "I've earned ৳4,200 cashback in 3 months just by shopping things I was already buying!"
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">R</div>
            <span className="text-xs font-semibold text-teal-200">Rahim U., Dhaka</span>
          </div>
        </div>
      </div>

      {/* Right: signup form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-4 py-10 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-xl text-primary">BDCashBack</span>
          </Link>
          <p className="text-sm text-muted-foreground">Create your account and start earning cashback</p>
        </div>

        <div className="w-full max-w-[440px] space-y-4">
          <SignUpForm role="customer" redirectUrl="/" signInUrl="/sign-in" />

          {/* Benefits checklist under form on mobile */}
          <div className="lg:hidden mt-4 space-y-2 px-2">
            {["Free to join", "No subscription fees", "Withdraw anytime"].map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
