import { useEffect, useState } from 'react';
import { Plus, RefreshCcw, Save } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import Metric from '../components/Metric.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

function TenantTable({ tenants, onToggle }) {
  if (!tenants.length) return <EmptyState>No tenants yet.</EmptyState>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Code</th>
            <th>Users</th>
            <th>Products</th>
            <th>Transactions</th>
            <th>Status</th>
            {onToggle && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.tenant_id}>
              <td>
                <strong>{tenant.tenant_name}</strong>
                <span className="subtext">{tenant.email || 'No email'}</span>
              </td>
              <td>{tenant.tenant_code}</td>
              <td>{tenant.user_count}</td>
              <td>{tenant.product_count}</td>
              <td>{tenant.transaction_count}</td>
              <td><StatusBadge status={tenant.status} /></td>
              {onToggle && (
                <td>
                  <button className="button compact" onClick={() => onToggle(tenant)} type="button">
                    {tenant.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserTable({ users, showTenant = false }) {
  if (!users.length) return <EmptyState>No users yet.</EmptyState>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {showTenant && <th>Tenant</th>}
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={`${user.tenant_id}-${user.user_id}`}>
              <td>
                <strong>{user.full_name}</strong>
                <span className="subtext">{user.email || 'No email'}</span>
              </td>
              {showTenant && <td>{user.tenant_name}</td>}
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td><StatusBadge status={user.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlatformOverview({ apiCall, showToast }) {
  const [summary, setSummary] = useState(null);
  const [tenants, setTenants] = useState([]);

  const load = async () => {
    const [overviewResponse, tenantsResponse] = await Promise.all([
      apiCall('/api/admin/overview'),
      apiCall('/api/admin/tenants')
    ]);

    setSummary(overviewResponse.summary);
    setTenants(tenantsResponse.tenants.slice(0, 6));
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message));
  }, []);

  if (!summary) return <EmptyState>Loading overview...</EmptyState>;

  return (
    <section className="content-stack">
      <div className="metric-grid">
        <Metric label="Tenants" value={summary.tenant_count} />
        <Metric label="Tenant users" value={summary.tenant_user_count} />
        <Metric label="Products" value={summary.product_count} />
        <Metric label="Transactions" value={summary.transaction_count} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Recent tenants</h2>
          <button className="icon-button" onClick={load} type="button" aria-label="Refresh">
            <RefreshCcw size={17} />
          </button>
        </div>
        <TenantTable tenants={tenants} />
      </section>
    </section>
  );
}

export function TenantsPage({ apiCall, showToast }) {
  const [tenants, setTenants] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadTenants = async () => {
    const response = await apiCall('/api/admin/tenants');
    setTenants(response.tenants);
  };

  useEffect(() => {
    loadTenants().catch((error) => showToast(error.message));
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    setSubmitting(true);
    try {
      await apiCall('/api/admin/tenants', { method: 'POST', body });
      event.currentTarget.reset();
      showToast('Tenant created');
      await loadTenants();
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (tenant) => {
    const status = tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiCall(`/api/admin/tenants/${tenant.tenant_id}`, {
        method: 'PATCH',
        body: { status }
      });
      showToast('Tenant updated');
      await loadTenants();
    } catch (error) {
      showToast(error.message);
    }
  };

  return (
    <section className="split-layout">
      <section className="panel">
        <div className="panel-heading">
          <h2>Create tenant</h2>
        </div>
        <form className="form-stack" onSubmit={handleCreate}>
          <Field label="Tenant code"><input name="tenantCode" placeholder="coffeehouse" required /></Field>
          <Field label="Tenant name"><input name="tenantName" placeholder="Cloud Coffee House" required /></Field>
          <div className="form-grid">
            <Field label="Email"><input name="email" type="email" /></Field>
            <Field label="Phone"><input name="phone" /></Field>
          </div>
          <Field label="Address"><input name="address" /></Field>

          <div className="form-divider" />

          <Field label="First admin name"><input name="adminFullName" placeholder="Store Owner" /></Field>
          <Field label="First admin username"><input name="adminUsername" placeholder="owner" /></Field>
          <Field label="First admin email"><input name="adminEmail" type="email" /></Field>
          <Field label="First admin password"><input name="adminPassword" type="password" /></Field>

          <button className="button primary" disabled={submitting} type="submit">
            <Plus size={18} />
            {submitting ? 'Creating...' : 'Create tenant'}
          </button>
        </form>
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>Tenant list</h2>
          <button className="icon-button" onClick={loadTenants} type="button" aria-label="Refresh tenants">
            <RefreshCcw size={17} />
          </button>
        </div>
        <TenantTable tenants={tenants} onToggle={handleToggle} />
      </section>
    </section>
  );
}

export function PlatformUsersPage({ apiCall, showToast }) {
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [tenantResponse, userResponse] = await Promise.all([
      apiCall('/api/admin/tenants'),
      apiCall('/api/admin/users')
    ]);
    setTenants(tenantResponse.tenants);
    setUsers(userResponse.users);
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message));
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    setSubmitting(true);
    try {
      await apiCall('/api/admin/users', { method: 'POST', body });
      event.currentTarget.reset();
      showToast('User created');
      await load();
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="split-layout">
      <section className="panel">
        <div className="panel-heading">
          <h2>Create tenant user</h2>
        </div>
        <form className="form-stack" onSubmit={handleCreate}>
          <Field label="Tenant">
            <select name="tenantId" required>
              {tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.tenant_name} ({tenant.tenant_code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Full name"><input name="fullName" required /></Field>
          <Field label="Username"><input name="username" required /></Field>
          <Field label="Email"><input name="email" type="email" /></Field>
          <Field label="Password"><input name="password" type="password" required /></Field>
          <Field label="Role">
            <select name="role" defaultValue="STAFF">
              <option value="STAFF">STAFF</option>
              <option value="TENANT_ADMIN">TENANT_ADMIN</option>
            </select>
          </Field>
          <button className="button primary" disabled={submitting || !tenants.length} type="submit">
            <Save size={18} />
            {submitting ? 'Saving...' : 'Create user'}
          </button>
        </form>
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>All tenant users</h2>
          <button className="icon-button" onClick={load} type="button" aria-label="Refresh users">
            <RefreshCcw size={17} />
          </button>
        </div>
        <UserTable users={users} showTenant />
      </section>
    </section>
  );
}

export { UserTable };
