import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Mail, Lock, ArrowRight } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/");
    }, 800);
  };

  return (
    <div className="min-h-[100dvh] w-full flex bg-background">
      {/* Left section: Branding & Value Prop */}
      <div className="hidden lg:flex flex-1 bg-primary flex-col justify-between p-12 text-primary-foreground relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">BDCashBack</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg mb-20">
          <h1 className="text-5xl font-black leading-tight tracking-tight mb-6">
            Smart shopping starts here.
          </h1>
          <p className="text-teal-100 text-lg mb-8 leading-relaxed">
            Join thousands of shoppers saving money on every purchase. Get real cash back, exclusive deals, and premium rewards in one place.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-teal-100">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full bg-white/20 border-2 border-primary flex items-center justify-center backdrop-blur-md">
                  <span className="text-white font-bold text-xs">U{i}</span>
                </div>
              ))}
            </div>
            <span>Over 10k+ active users</span>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-600/30 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right section: Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 lg:p-24 bg-white relative">
        <Link href="/" className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-primary">BDCashBack</span>
        </Link>

        <div className="w-full max-w-md space-y-8 animate-in">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Enter your details to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold ml-1">Email address</label>
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  required 
                  icon={<Mail className="w-4 h-4" />}
                  className="bg-accent/30"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-semibold">Password</label>
                  <a href="#" className="text-sm text-primary font-semibold hover:underline">Forgot password?</a>
                </div>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  required
                  icon={<Lock className="w-4 h-4" />}
                  className="bg-accent/30"
                />
              </div>
            </div>

            <Button type="submit" className="w-full text-base h-12" disabled={isLoading}>
              {isLoading ? "Signing in..." : (
                <>Sign in to your account <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <a href="#" className="text-primary font-bold hover:underline">Create one</a>
          </div>
        </div>
      </div>
    </div>
  );
}
