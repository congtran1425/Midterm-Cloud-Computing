const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

const state = {
  token: localStorage.getItem('cloud_pos_token'),
  user: JSON.parse(localStorage.getItem('cloud_pos_user') || 'null'),
  loginMode: 'tenant',
  view: localStorage.getItem('cloud_pos_view') || 'pos',
  cart: [],
  products: [],
  editingProductId: null,
  selectedTransactionId: null
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value || 0));

const shortDate = (value) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '';

const showToast = (message) => {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 3200);
};

const api = async (path, options = {}) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

const formData = (form) => Object.fromEntries(new FormData(form).entries());

const setSession = ({ token, user }) => {
  state.token = token;
  state.user = user;
  localStorage.setItem('cloud_pos_token', token);
  localStorage.setItem('cloud_pos_user', JSON.stringify(user));
  state.view = user.scope === 'platform' ? 'overview' : 'pos';
  localStorage.setItem('cloud_pos_view', state.view);
};

const logout = () => {
  localStorage.removeItem('cloud_pos_token');
  localStorage.removeItem('cloud_pos_user');
  localStorage.removeItem('cloud_pos_view');
  state.token = null;
  state.user = null;
  state.cart = [];
  renderLogin();
};

const metric = (label, value) => `
  <div class="metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>
`;

const statusBadge = (status) => {
  const ok = ['ACTIVE', 'AVAILABLE', 'SENT', 'PAID'].includes(status);
  return `<span class="status ${ok ? 'ok' : 'bad'}">${escapeHtml(status || '')}</span>`;
};

const renderLogin = () => {
  const isTenant = state.loginMode === 'tenant';

  app.innerHTML = `
    <main class="login-page">
      <section class="login-panel">
        <h1>Cloud POS SaaS</h1>
        <p>Multi-tenant point-of-sale workspace</p>

        <div class="tabs">
          <button class="tab ${isTenant ? 'active' : ''}" data-login-mode="tenant" type="button">Tenant User</button>
          <button class="tab ${!isTenant ? 'active' : ''}" data-login-mode="platform" type="button">System Admin</button>
        </div>

        <form id="login-form" class="form-grid">
          ${isTenant ? `
            <div class="field">
              <label for="tenantCode">Tenant code</label>
              <input id="tenantCode" name="tenantCode" autocomplete="organization" value="coffeehouse" required>
            </div>
          ` : ''}
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" autocomplete="username" value="${isTenant ? 'owner' : 'superadmin'}" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" value="${isTenant ? 'Tenant@123' : 'Admin@123'}" required>
          </div>
          <button class="btn primary" type="submit">Sign in</button>
        </form>
      </section>
      <section class="login-side" aria-hidden="true">
        <div class="login-side-inner">
          <div class="signal"><strong>Tenant</strong><span>Each store works in its own isolated data space.</span></div>
          <div class="signal"><strong>Sales</strong><span>Create transactions, receipts, and email delivery from one flow.</span></div>
          <div class="signal"><strong>Cloud</strong><span>Ready for AWS with Express, MySQL, and SMTP.</span></div>
        </div>
      </section>
    </main>
  `;
};

const navItems = () => {
  if (state.user.scope === 'platform') {
    return [
      ['overview', 'Overview'],
      ['tenants', 'Tenants'],
      ['users', 'Users']
    ];
  }

  const items = [
    ['pos', 'POS'],
    ['products', 'Products'],
    ['transactions', 'Transactions']
  ];

  if (state.user.role === 'TENANT_ADMIN') {
    items.push(['team', 'Team']);
  }

  return items;
};

const viewTitle = () => {
  const labels = Object.fromEntries(navItems());
  return labels[state.view] || 'Dashboard';
};

const renderShell = (content = '<div class="empty">Loading...</div>') => {
  const nav = navItems().map(([view, label]) => `
    <button class="${state.view === view ? 'active' : ''}" data-view="${view}" type="button">${label}</button>
  `).join('');

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <h2>Cloud POS</h2>
          <p>${escapeHtml(state.user.scope === 'platform' ? 'System Admin' : state.user.tenantName)}</p>
        </div>
        <nav class="nav">${nav}</nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${escapeHtml(viewTitle())}</h1>
            <p>${escapeHtml(state.user.fullName)} · ${escapeHtml(state.user.username)}</p>
          </div>
          <button class="btn ghost" data-action="logout" type="button">Sign out</button>
        </header>
        ${content}
      </main>
    </div>
  `;
};

const navigate = async (view) => {
  state.view = view;
  localStorage.setItem('cloud_pos_view', view);
  renderShell();

  try {
    await renderCurrentView();
  } catch (error) {
    showToast(error.message);
    renderShell(`<div class="empty">${escapeHtml(error.message)}</div>`);
  }
};

const renderCurrentView = async () => {
  if (state.user.scope === 'platform') {
    if (state.view === 'tenants') return renderTenants();
    if (state.view === 'users') return renderPlatformUsers();
    return renderPlatformOverview();
  }

  if (state.view === 'products') return renderProducts();
  if (state.view === 'transactions') return renderTransactions();
  if (state.view === 'team') return renderTeam();
  return renderPos();
};

const renderPlatformOverview = async () => {
  const [{ summary }, { tenants }] = await Promise.all([
    api('/api/admin/overview'),
    api('/api/admin/tenants')
  ]);

  renderShell(`
    <section class="section">
      <div class="grid metrics">
        ${metric('Tenants', summary.tenant_count)}
        ${metric('Tenant users', summary.tenant_user_count)}
        ${metric('Products', summary.product_count)}
        ${metric('Transactions', summary.transaction_count)}
      </div>
      <div class="panel">
        <h2>Recent tenants</h2>
        ${tenantTable(tenants.slice(0, 6))}
      </div>
    </section>
  `);
};

const tenantTable = (tenants) => tenants.length ? `
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Tenant</th><th>Code</th><th>Users</th><th>Products</th><th>Transactions</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${tenants.map((tenant) => `
          <tr>
            <td><strong>${escapeHtml(tenant.tenant_name)}</strong><br><span class="muted">${escapeHtml(tenant.email || '')}</span></td>
            <td>${escapeHtml(tenant.tenant_code)}</td>
            <td>${tenant.user_count}</td>
            <td>${tenant.product_count}</td>
            <td>${tenant.transaction_count}</td>
            <td>${statusBadge(tenant.status)}</td>
            <td>
              <button class="btn" data-tenant-id="${tenant.tenant_id}" data-tenant-status="${tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}" type="button">
                ${tenant.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
` : '<div class="empty">No tenants yet.</div>';

const renderTenants = async () => {
  const { tenants } = await api('/api/admin/tenants');

  renderShell(`
    <section class="grid two">
      <div class="panel">
        <h2>Create tenant</h2>
        <form id="tenant-form" class="form-grid">
          <div class="field"><label>Tenant code</label><input name="tenantCode" placeholder="coffeehouse" required></div>
          <div class="field"><label>Tenant name</label><input name="tenantName" placeholder="Cloud Coffee House" required></div>
          <div class="field"><label>Email</label><input name="email" type="email"></div>
          <div class="field"><label>Phone</label><input name="phone"></div>
          <div class="field"><label>Address</label><input name="address"></div>
          <hr>
          <div class="field"><label>First admin name</label><input name="adminFullName" placeholder="Store Owner"></div>
          <div class="field"><label>First admin username</label><input name="adminUsername" placeholder="owner"></div>
          <div class="field"><label>First admin email</label><input name="adminEmail" type="email"></div>
          <div class="field"><label>First admin password</label><input name="adminPassword" type="password"></div>
          <button class="btn primary" type="submit">Create tenant</button>
        </form>
      </div>
      <div class="panel">
        <h2>Tenant list</h2>
        ${tenantTable(tenants)}
      </div>
    </section>
  `);
};

const renderPlatformUsers = async () => {
  const [{ tenants }, { users }] = await Promise.all([
    api('/api/admin/tenants'),
    api('/api/admin/users')
  ]);

  const tenantOptions = tenants.map((tenant) => `
    <option value="${tenant.tenant_id}">${escapeHtml(tenant.tenant_name)} (${escapeHtml(tenant.tenant_code)})</option>
  `).join('');

  renderShell(`
    <section class="grid two">
      <div class="panel">
        <h2>Create tenant user</h2>
        <form id="platform-user-form" class="form-grid">
          <div class="field"><label>Tenant</label><select name="tenantId" required>${tenantOptions}</select></div>
          <div class="field"><label>Full name</label><input name="fullName" required></div>
          <div class="field"><label>Username</label><input name="username" required></div>
          <div class="field"><label>Email</label><input name="email" type="email"></div>
          <div class="field"><label>Password</label><input name="password" type="password" required></div>
          <div class="field"><label>Role</label><select name="role"><option>TENANT_ADMIN</option><option>STAFF</option></select></div>
          <button class="btn primary" type="submit">Create user</button>
        </form>
      </div>
      <div class="panel">
        <h2>All tenant users</h2>
        ${userTable(users, true)}
      </div>
    </section>
  `);
};

const userTable = (users, showTenant = false) => users.length ? `
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Name</th>${showTenant ? '<th>Tenant</th>' : ''}<th>Username</th><th>Role</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${users.map((user) => `
          <tr>
            <td><strong>${escapeHtml(user.full_name)}</strong><br><span class="muted">${escapeHtml(user.email || '')}</span></td>
            ${showTenant ? `<td>${escapeHtml(user.tenant_name || '')}</td>` : ''}
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${statusBadge(user.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
` : '<div class="empty">No users yet.</div>';

const renderPos = async () => {
  const [{ products }, { summary }] = await Promise.all([
    api('/api/tenant/products?status=AVAILABLE'),
    api('/api/tenant/transactions/overview')
  ]);

  state.products = products;

  renderShell(`
    <section class="section">
      <div class="grid metrics">
        ${metric('Today sales', money(summary.today_revenue))}
        ${metric('Today orders', summary.today_transaction_count)}
        ${metric('Total revenue', money(summary.revenue))}
        ${metric('Average sale', money(summary.average_sale))}
      </div>
      <div class="grid two">
        <div class="panel">
          <div class="toolbar">
            <h2 style="margin-right:auto;">Products</h2>
            <input id="product-search" placeholder="Search products" aria-label="Search products">
          </div>
          <div class="product-list" id="product-list">
            ${productCards(products)}
          </div>
        </div>
        <div class="panel">
          <h2>Current sale</h2>
          <form id="checkout-form" class="form-grid">
            <div id="cart">${cartMarkup()}</div>
            <div class="cart-total"><span>Total</span><strong>${money(cartTotal())}</strong></div>
            <div class="form-grid two">
              <div class="field"><label>Customer name</label><input name="customerName"></div>
              <div class="field"><label>Customer email</label><input name="customerEmail" type="email"></div>
            </div>
            <label class="toolbar"><input name="sendEmail" type="checkbox" value="true"> Send receipt email</label>
            <div class="cart-actions">
              <button class="btn primary" type="submit" ${state.cart.length ? '' : 'disabled'}>Complete sale</button>
              <button class="btn" data-action="clear-cart" type="button" ${state.cart.length ? '' : 'disabled'}>Clear</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `);
};

const productCards = (products) => products.length ? products.map((product) => `
  <article class="product-card" data-product-card>
    <strong>${escapeHtml(product.product_name)}</strong>
    <span class="muted">${escapeHtml(product.category || 'Uncategorized')} · Stock ${product.stock_quantity}</span>
    <span>${money(product.price)}</span>
    <button class="btn primary" data-add-product="${product.product_id}" type="button" ${product.stock_quantity <= 0 ? 'disabled' : ''}>Add</button>
  </article>
`).join('') : '<div class="empty">No available products.</div>';

const cartTotal = () => state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

const cartMarkup = () => state.cart.length ? state.cart.map((item) => `
  <div class="cart-item">
    <div><strong>${escapeHtml(item.productName)}</strong><br><span class="muted">${money(item.price)}</span></div>
    <div class="toolbar">
      <button class="icon-btn" data-cart-dec="${item.productId}" type="button">-</button>
      <strong>${item.quantity}</strong>
      <button class="icon-btn" data-cart-inc="${item.productId}" type="button">+</button>
    </div>
    <button class="icon-btn" data-cart-remove="${item.productId}" type="button">Remove</button>
  </div>
`).join('') : '<div class="empty">Cart is empty.</div>';

const renderProducts = async () => {
  const { products } = await api('/api/tenant/products');
  state.products = products;
  const editing = products.find((product) => product.product_id === state.editingProductId);

  renderShell(`
    <section class="grid two">
      <div class="panel">
        <h2>${editing ? 'Edit product' : 'Create product'}</h2>
        <form id="product-form" class="form-grid" data-editing-id="${editing?.product_id || ''}">
          <div class="field"><label>SKU</label><input name="sku" value="${escapeHtml(editing?.sku || '')}"></div>
          <div class="field"><label>Product name</label><input name="productName" value="${escapeHtml(editing?.product_name || '')}" required></div>
          <div class="field"><label>Category</label><input name="category" value="${escapeHtml(editing?.category || '')}"></div>
          <div class="field"><label>Description</label><textarea name="description">${escapeHtml(editing?.description || '')}</textarea></div>
          <div class="form-grid two">
            <div class="field"><label>Price</label><input name="price" type="number" min="0" step="0.01" value="${editing?.price ?? ''}" required></div>
            <div class="field"><label>Stock</label><input name="stockQuantity" type="number" min="0" step="1" value="${editing?.stock_quantity ?? 0}"></div>
          </div>
          <div class="field"><label>Status</label><select name="status">
            <option ${editing?.status === 'AVAILABLE' ? 'selected' : ''}>AVAILABLE</option>
            <option ${editing?.status === 'UNAVAILABLE' ? 'selected' : ''}>UNAVAILABLE</option>
          </select></div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${editing ? 'Save product' : 'Create product'}</button>
            ${editing ? '<button class="btn" data-action="cancel-product-edit" type="button">Cancel</button>' : ''}
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Products</h2>
        ${products.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${products.map((product) => `
                  <tr>
                    <td><strong>${escapeHtml(product.product_name)}</strong><br><span class="muted">${escapeHtml(product.category || '')}</span></td>
                    <td>${escapeHtml(product.sku || '')}</td>
                    <td>${money(product.price)}</td>
                    <td>${product.stock_quantity}</td>
                    <td>${statusBadge(product.status)}</td>
                    <td><button class="btn" data-edit-product="${product.product_id}" type="button">Edit</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No products yet.</div>'}
      </div>
    </section>
  `);
};

const renderTransactions = async () => {
  const { transactions } = await api('/api/tenant/transactions');
  let receipt = null;

  if (state.selectedTransactionId) {
    try {
      receipt = (await api(`/api/tenant/transactions/${state.selectedTransactionId}`)).receipt;
    } catch (_error) {
      state.selectedTransactionId = null;
    }
  }

  renderShell(`
    <section class="grid two">
      <div class="panel">
        <h2>Transactions</h2>
        ${transactions.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Total</th><th>Email</th><th></th></tr></thead>
              <tbody>
                ${transactions.map((tx) => `
                  <tr>
                    <td>#${tx.transaction_id}</td>
                    <td>${shortDate(tx.transaction_date)}</td>
                    <td>${escapeHtml(tx.customer_name || tx.customer_email || 'Walk-in')}</td>
                    <td>${money(tx.total_amount)}</td>
                    <td>${statusBadge(tx.email_status || 'NOT_SENT')}</td>
                    <td><button class="btn" data-view-transaction="${tx.transaction_id}" type="button">View</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No transactions yet.</div>'}
      </div>
      <div class="panel">
        ${receipt ? receiptMarkup(receipt) : '<div class="empty">Select a transaction to view the receipt.</div>'}
      </div>
    </section>
  `);
};

const receiptMarkup = (receipt) => `
  <div class="receipt">
    <div class="receipt-header">
      <div>
        <h2>${escapeHtml(receipt.tenant_name)}</h2>
        <p class="muted">${escapeHtml(receipt.address || '')}</p>
      </div>
      <div>
        <strong>${escapeHtml(receipt.receipt_code)}</strong><br>
        <span class="muted">${escapeHtml(receipt.transaction_date_display)}</span>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          ${receipt.items.map((item) => `
            <tr>
              <td>${escapeHtml(item.product_name)}</td>
              <td>${item.quantity}</td>
              <td>${money(item.unit_price)}</td>
              <td>${money(item.line_total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="receipt-total">
      <span>${statusBadge(receipt.email_status)}</span>
      <strong>Total ${money(receipt.total_amount)}</strong>
    </div>
    <form id="receipt-email-form" class="toolbar" data-transaction-id="${receipt.transaction_id}">
      <input name="recipientEmail" type="email" placeholder="customer@example.com" value="${escapeHtml(receipt.recipient_email || receipt.customer_email || '')}">
      <button class="btn primary" type="submit">Send email</button>
    </form>
  </div>
`;

const renderTeam = async () => {
  const { users } = await api('/api/tenant/users');

  renderShell(`
    <section class="grid two">
      <div class="panel">
        <h2>Create user</h2>
        <form id="tenant-user-form" class="form-grid">
          <div class="field"><label>Full name</label><input name="fullName" required></div>
          <div class="field"><label>Username</label><input name="username" required></div>
          <div class="field"><label>Email</label><input name="email" type="email"></div>
          <div class="field"><label>Password</label><input name="password" type="password" required></div>
          <div class="field"><label>Role</label><select name="role"><option>STAFF</option><option>TENANT_ADMIN</option></select></div>
          <button class="btn primary" type="submit">Create user</button>
        </form>
      </div>
      <div class="panel">
        <h2>Team</h2>
        ${userTable(users)}
      </div>
    </section>
  `);
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  try {
    if (button.dataset.loginMode) {
      state.loginMode = button.dataset.loginMode;
      renderLogin();
      return;
    }

    if (button.dataset.action === 'logout') {
      logout();
      return;
    }

    if (button.dataset.view) {
      await navigate(button.dataset.view);
      return;
    }

    if (button.dataset.tenantId) {
      await api(`/api/admin/tenants/${button.dataset.tenantId}`, {
        method: 'PATCH',
        body: { status: button.dataset.tenantStatus }
      });
      showToast('Tenant updated');
      await navigate('tenants');
      return;
    }

    if (button.dataset.addProduct) {
      const product = state.products.find((item) => item.product_id === Number(button.dataset.addProduct));
      const existing = state.cart.find((item) => item.productId === product.product_id);

      if (existing) {
        existing.quantity += 1;
      } else {
        state.cart.push({
          productId: product.product_id,
          productName: product.product_name,
          price: Number(product.price),
          quantity: 1
        });
      }

      await renderPos();
      return;
    }

    if (button.dataset.cartInc || button.dataset.cartDec || button.dataset.cartRemove) {
      const productId = Number(button.dataset.cartInc || button.dataset.cartDec || button.dataset.cartRemove);
      const item = state.cart.find((cartItem) => cartItem.productId === productId);

      if (button.dataset.cartRemove) {
        state.cart = state.cart.filter((cartItem) => cartItem.productId !== productId);
      } else if (item && button.dataset.cartInc) {
        item.quantity += 1;
      } else if (item && button.dataset.cartDec) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          state.cart = state.cart.filter((cartItem) => cartItem.productId !== productId);
        }
      }

      await renderPos();
      return;
    }

    if (button.dataset.action === 'clear-cart') {
      state.cart = [];
      await renderPos();
      return;
    }

    if (button.dataset.editProduct) {
      state.editingProductId = Number(button.dataset.editProduct);
      await navigate('products');
      return;
    }

    if (button.dataset.action === 'cancel-product-edit') {
      state.editingProductId = null;
      await navigate('products');
      return;
    }

    if (button.dataset.viewTransaction) {
      state.selectedTransactionId = button.dataset.viewTransaction;
      await navigate('transactions');
    }
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'product-search') return;

  const term = event.target.value.toLowerCase();
  const filtered = state.products.filter((product) => [
    product.product_name,
    product.category,
    product.sku
  ].some((value) => String(value || '').toLowerCase().includes(term)));

  document.querySelector('#product-list').innerHTML = productCards(filtered);
});

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = formData(form);

  try {
    if (form.id === 'login-form') {
      const endpoint = state.loginMode === 'tenant' ? '/api/auth/tenant/login' : '/api/auth/platform/login';
      const session = await api(endpoint, { method: 'POST', body: data });
      setSession(session);
      await navigate(state.view);
      return;
    }

    if (form.id === 'tenant-form') {
      await api('/api/admin/tenants', { method: 'POST', body: data });
      showToast('Tenant created');
      await navigate('tenants');
      return;
    }

    if (form.id === 'platform-user-form') {
      await api('/api/admin/users', { method: 'POST', body: data });
      showToast('User created');
      await navigate('users');
      return;
    }

    if (form.id === 'tenant-user-form') {
      await api('/api/tenant/users', { method: 'POST', body: data });
      showToast('User created');
      await navigate('team');
      return;
    }

    if (form.id === 'product-form') {
      const body = {
        ...data,
        price: Number(data.price),
        stockQuantity: Number(data.stockQuantity || 0)
      };
      const editingId = form.dataset.editingId;

      if (editingId) {
        await api(`/api/tenant/products/${editingId}`, { method: 'PATCH', body });
        state.editingProductId = null;
        showToast('Product updated');
      } else {
        await api('/api/tenant/products', { method: 'POST', body });
        showToast('Product created');
      }

      await navigate('products');
      return;
    }

    if (form.id === 'checkout-form') {
      const body = {
        customerName: data.customerName || null,
        customerEmail: data.customerEmail || null,
        sendEmail: data.sendEmail === 'true',
        items: state.cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };

      const { receipt } = await api('/api/tenant/transactions', { method: 'POST', body });
      state.cart = [];
      state.selectedTransactionId = receipt.transaction_id;
      showToast('Sale completed');
      await navigate('transactions');
      return;
    }

    if (form.id === 'receipt-email-form') {
      await api(`/api/tenant/transactions/${form.dataset.transactionId}/send-email`, {
        method: 'POST',
        body: { recipientEmail: data.recipientEmail }
      });
      showToast('Receipt email sent');
      await navigate('transactions');
    }
  } catch (error) {
    showToast(error.message);
  }
});

const init = async () => {
  if (!state.token || !state.user) {
    renderLogin();
    return;
  }

  renderShell();
  try {
    await api('/api/auth/me');
    await navigate(state.view);
  } catch (_error) {
    logout();
  }
};

init();
