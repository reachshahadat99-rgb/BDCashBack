import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Shell } from './components/layout/Shell';
import Home from './pages/Home';
import Products from './pages/Products';
import Wallet from './pages/Wallet';
import Login from './pages/Login';
import * as React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <a href="/" className="text-primary font-semibold hover:underline">Return to Home</a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products" component={Products} />
      <Route path="/wallet" component={Wallet} />
      {/* Login doesn't need the Shell wrapper typically, but we handle it via a separate top-level route if we want to bypass shell. 
          For simplicity, we'll bypass Shell for login. */}
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <Shell>
          <Router />
        </Shell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppContent />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
