import {
  BarChart3,
  Box,
  Building2,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShoppingCart,
  Users
} from 'lucide-react';

const navConfig = {
  platform: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users }
  ],
  tenant: [
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Box },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'team', label: 'Team', icon: Users, adminOnly: true }
  ]
};

export const getNavItems = (user) => {
  const items = navConfig[user?.scope] || [];

  if (user?.scope !== 'tenant') return items;

  return items.filter((item) => !item.adminOnly || user.role === 'TENANT_ADMIN');
};

export default function AppShell({ user, view, onViewChange, onLogout, children }) {
  const navItems = getNavItems(user);
  const title = navItems.find((item) => item.id === view)?.label || 'Dashboard';
  const contextLabel = user.scope === 'platform' ? 'System Admin' : user.tenantName;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CP</div>
          <div>
            <strong>Cloud POS</strong>
            <span>{contextLabel}</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={view === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => onViewChange(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>{user.fullName} · {user.username}</p>
          </div>
          <button className="button subtle" onClick={onLogout} type="button">
            <LogOut aria-hidden="true" size={18} />
            Sign out
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}
