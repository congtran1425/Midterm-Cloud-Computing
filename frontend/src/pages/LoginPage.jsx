import { useState } from 'react';
import { Building2, LockKeyhole, ShieldCheck } from 'lucide-react';
import Field from '../components/Field.jsx';

export default function LoginPage({ onLogin, showToast }) {
  const [mode, setMode] = useState('tenant');
  const [submitting, setSubmitting] = useState(false);

  const isTenant = mode === 'tenant';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint = isTenant ? '/api/auth/tenant/login' : '/api/auth/platform/login';

    setSubmitting(true);
    try {
      await onLogin(endpoint, values);
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <div className="brand-mark large">CP</div>
          <div>
            <h1 id="login-title">Cloud POS SaaS</h1>
            <p>Multi-tenant point-of-sale workspace</p>
          </div>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Login mode">
          <button
            aria-selected={isTenant}
            className={isTenant ? 'active' : ''}
            onClick={() => setMode('tenant')}
            type="button"
          >
            <Building2 size={17} aria-hidden="true" />
            Tenant User
          </button>
          <button
            aria-selected={!isTenant}
            className={!isTenant ? 'active' : ''}
            onClick={() => setMode('platform')}
            type="button"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            System Admin
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          {isTenant && (
            <Field label="Tenant code">
              <input name="tenantCode" defaultValue="coffeehouse" autoComplete="organization" required />
            </Field>
          )}
          <Field label="Username">
            <input name="username" defaultValue={isTenant ? 'owner' : 'superadmin'} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input
              name="password"
              defaultValue={isTenant ? 'Tenant@123' : 'Admin@123'}
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <button className="button primary full" disabled={submitting} type="submit">
            <LockKeyhole size={18} aria-hidden="true" />
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>

      <section className="login-canvas" aria-hidden="true">
        <div className="signal-board">
          <article>
            <span>Tenants</span>
            <strong>Isolated</strong>
          </article>
          <article>
            <span>Receipts</span>
            <strong>Email</strong>
          </article>
          <article>
            <span>Cloud</span>
            <strong>AWS-ready</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
