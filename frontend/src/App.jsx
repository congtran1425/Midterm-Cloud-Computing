import { useEffect, useState } from 'react';
import AppShell, { getNavItems } from './components/AppShell.jsx';
import Toast from './components/Toast.jsx';
import { clearSession, loadSession, request, saveSession } from './lib/api.js';
import LoginPage from './pages/LoginPage.jsx';
import { PlatformOverview, PlatformUsersPage, TenantsPage } from './pages/PlatformPages.jsx';
import { InventoryPage, PaymentCheckoutPage, PosPage, ProductsPage, TeamPage, TransactionsPage } from './pages/TenantPages.jsx';

const VIEW_KEY = 'cloud_pos_view';

const defaultViewFor = (user) => user?.scope === 'platform' ? 'overview' : 'pos';

export default function App() {
  const initialSession = loadSession();
  const [token, setToken] = useState(initialSession.token);
  const [user, setUser] = useState(initialSession.user);
  const [view, setView] = useState(localStorage.getItem(VIEW_KEY) || defaultViewFor(initialSession.user));
  const [toast, setToast] = useState('');
  const [booting, setBooting] = useState(Boolean(initialSession.token));
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 3200);
  };

  const apiCall = (path, options) => request(path, { ...options, token });

  const updateView = (nextView) => {
    setView(nextView);
    localStorage.setItem(VIEW_KEY, nextView);
  };

  const handleLogin = async (endpoint, body) => {
    const session = await request(endpoint, { method: 'POST', body });
    saveSession(session);
    setToken(session.token);
    setUser(session.user);
    updateView(defaultViewFor(session.user));
  };

  const handleLogout = () => {
    clearSession();
    localStorage.removeItem(VIEW_KEY);
    sessionStorage.removeItem('pos_cart');
    setToken(null);
    setUser(null);
    setSelectedTransactionId(null);
  };

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    request('/api/auth/me', { token })
      .then((response) => {
        setUser(response.user);
        const allowedViews = getNavItems(response.user).map((item) => item.id);
        if (!allowedViews.includes(view)) {
          updateView(defaultViewFor(response.user));
        }
      })
      .catch(() => handleLogout())
      .finally(() => setBooting(false));
  }, []);

  const renderView = () => {
    const commonProps = { apiCall, showToast };

    if (user.scope === 'platform') {
      if (view === 'tenants') return <TenantsPage {...commonProps} />;
      if (view === 'users') return <PlatformUsersPage {...commonProps} />;
      return <PlatformOverview {...commonProps} />;
    }

    if (view === 'products') return <ProductsPage {...commonProps} />;
    if (view === 'inventory') return <InventoryPage {...commonProps} />;
    if (view === 'checkout') {
      return (
        <PaymentCheckoutPage
          {...commonProps}
          orderId={selectedOrderId}
          onPaymentComplete={(transactionId) => {
            sessionStorage.removeItem('pos_cart');
            setSelectedTransactionId(transactionId);
            updateView('transactions');
          }}
          onGoBack={() => updateView('pos')}
        />
      );
    }
    if (view === 'transactions') {
      return (
        <TransactionsPage
          {...commonProps}
          selectedTransactionId={selectedTransactionId}
          setSelectedTransactionId={setSelectedTransactionId}
        />
      );
    }
    if (view === 'team') return <TeamPage {...commonProps} />;

    return (
      <PosPage
        {...commonProps}
        onOrderCreated={(orderId) => {
          setSelectedOrderId(orderId);
          updateView('checkout');
        }}
      />
    );
  };

  if (booting) {
    return (
      <>
        <main className="boot-screen">Loading Cloud POS...</main>
        <Toast message={toast} />
      </>
    );
  }

  if (!token || !user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} showToast={showToast} />
        <Toast message={toast} />
      </>
    );
  }

  return (
    <>
      <AppShell user={user} view={view} onViewChange={updateView} onLogout={handleLogout}>
        {renderView()}
      </AppShell>
      <Toast message={toast} />
    </>
  );
}
