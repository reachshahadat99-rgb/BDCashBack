import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Shell } from './components/layout/Shell';
import Home from './pages/Home';
import Products from './pages/Products';
import Wallet from './pages/Wallet';
import Merchant from './pages/Merchant';
import Coupons from './pages/Coupons';
import Deals from './pages/Deals';
import Cashback from './pages/Cashback';
import GroupBuy from './pages/GroupBuy';
import GiftCards from './pages/GiftCards';
import MerchantPromotions from './pages/MerchantPromotions';
import Admin from './pages/Admin';
import CustomerSignup from './pages/CustomerSignup';
import MerchantSignup from './pages/MerchantSignup';
import Orders from './pages/Orders';
import Account from './pages/Account';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignInForm } from './components/auth/SignInForm';
import { SignUpForm } from './components/auth/SignUpForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <a href="/" className="text-primary font-semibold hover:underline">Return to Home</a>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignInForm redirectUrl="/" />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUpForm role="customer" redirectUrl="/" signInUrl="/sign-in" />
    </div>
  );
}

function ProfilePage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <span className="text-2xl font-black">U</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your account is waiting</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to manage your personal details and BDCashBack account.
          </p>
          <a
            href="/sign-in"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // Simple profile page (no Clerk UserProfile widget needed)
  return <Account />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products" component={Products} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/orders" component={Orders} />
      <Route path="/account" component={Account} />
      <Route path="/merchant" component={Merchant} />
      <Route path="/merchant/promotions" component={MerchantPromotions} />
      <Route path="/admin" component={Admin} />
      <Route path="/coupons" component={Coupons} />
      <Route path="/deals" component={Deals} />
      <Route path="/cashback" component={Cashback} />
      <Route path="/group-buy" component={GroupBuy} />
      <Route path="/gift-cards" component={GiftCards} />
      <Route path="/profile/*?" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/signup/customer/*?" component={CustomerSignup} />
      <Route path="/signup/merchant" component={MerchantSignup} />
      <Route>
        <Shell>
          <AppRoutes />
        </Shell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider onUserChange={(userId) => { if (userId === null) queryClient.clear(); }}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
