import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Trash2
} from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import Field from '../components/Field.jsx';
import Metric from '../components/Metric.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { money, shortDate, toNumber } from '../lib/format.js';
import { UserTable } from './PlatformPages.jsx';

function ProductTile({ product, onAdd }) {
  return (
    <article className="product-tile">
      <div>
        <strong>{product.product_name}</strong>
        <span>{product.category || 'Uncategorized'} · Stock {product.stock_quantity}</span>
      </div>
      <div className="tile-footer">
        <b>{money(product.price)}</b>
        <button
          className="button compact primary"
          disabled={product.stock_quantity <= 0}
          onClick={() => onAdd(product)}
          type="button"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
    </article>
  );
}

function CartLine({ item, onChange, onRemove }) {
  return (
    <div className="cart-line">
      <div>
        <strong>{item.productName}</strong>
        <span>{money(item.price)} each</span>
      </div>
      <div className="stepper">
        <button className="icon-button" onClick={() => onChange(item.productId, -1)} type="button" aria-label="Decrease quantity">
          <Minus size={15} />
        </button>
        <b>{item.quantity}</b>
        <button className="icon-button" onClick={() => onChange(item.productId, 1)} type="button" aria-label="Increase quantity">
          <Plus size={15} />
        </button>
      </div>
      <button className="icon-button danger" onClick={() => onRemove(item.productId)} type="button" aria-label="Remove item">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function PosPage({ apiCall, showToast, onOrderCreated }) {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [productResponse, overviewResponse] = await Promise.all([
      apiCall('/api/tenant/products?status=AVAILABLE'),
      apiCall('/api/tenant/transactions/overview')
    ]);
    setProducts(productResponse.products);
    setSummary(overviewResponse.summary);
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message));
  }, []);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.product_id);
      if (existing) {
        return current.map((item) => item.productId === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }

      return [
        ...current,
        {
          productId: product.product_id,
          productName: product.product_name,
          price: Number(product.price),
          quantity: 1
        }
      ];
    });
  };

  const changeQuantity = (productId, amount) => {
    setCart((current) => current
      .map((item) => item.productId === productId
        ? { ...item, quantity: item.quantity + amount }
        : item)
      .filter((item) => item.quantity > 0));
  };

  const removeItem = (productId) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const filteredProducts = products.filter((product) => [
    product.product_name,
    product.category,
    product.sku
  ].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())));

  const handleCheckout = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());

    setSubmitting(true);
    try {
      const response = await apiCall('/api/tenant/orders', {
        method: 'POST',
        body: {
          customerName: values.customerName || null,
          customerEmail: values.customerEmail || null,
          sendEmail: values.sendEmail === 'true',
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        }
      });

      setCart([]);
      showToast('Order created');
      onOrderCreated(response.order.transaction_id);
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!summary) return <EmptyState>Loading POS...</EmptyState>;

  return (
    <section className="content-stack">
      <div className="metric-grid">
        <Metric label="Today sales" value={money(summary.today_revenue)} />
        <Metric label="Today orders" value={summary.today_transaction_count} />
        <Metric label="Total revenue" value={money(summary.revenue)} />
        <Metric label="Average sale" value={money(summary.average_sale)} />
      </div>

      <section className="pos-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Products</h2>
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" />
            </label>
          </div>
          <div className="product-grid">
            {filteredProducts.length
              ? filteredProducts.map((product) => (
                <ProductTile key={product.product_id} product={product} onAdd={addToCart} />
              ))
              : <EmptyState>No matching products.</EmptyState>}
          </div>
        </div>

        <form className="panel checkout-panel" onSubmit={handleCheckout}>
          <div className="panel-heading">
            <h2>Current sale</h2>
            <button className="icon-button" onClick={load} type="button" aria-label="Refresh POS">
              <RefreshCcw size={17} />
            </button>
          </div>

          <div className="cart-list">
            {cart.length
              ? cart.map((item) => (
                <CartLine key={item.productId} item={item} onChange={changeQuantity} onRemove={removeItem} />
              ))
              : <EmptyState>Cart is empty.</EmptyState>}
          </div>

          <div className="sale-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>

          <div className="form-grid">
            <Field label="Customer name"><input name="customerName" /></Field>
            <Field label="Customer email"><input name="customerEmail" type="email" /></Field>
          </div>

          <label className="check-row">
            <input name="sendEmail" type="checkbox" value="true" />
            <span>Send receipt email</span>
          </label>

          <div className="button-row">
            <button className="button primary" disabled={!cart.length || submitting} type="submit">
              <Check size={18} />
              {submitting ? 'Creating...' : 'Create order'}
            </button>
            <button className="button subtle" disabled={!cart.length} onClick={() => setCart([])} type="button">
              Clear
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

export function ProductsPage({ apiCall, showToast }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const response = await apiCall('/api/tenant/products');
    setProducts(response.products);
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = {
      ...values,
      price: toNumber(values.price),
      stockQuantity: toNumber(values.stockQuantity)
    };

    setSubmitting(true);
    try {
      if (editing) {
        await apiCall(`/api/tenant/products/${editing.product_id}`, { method: 'PATCH', body });
        showToast('Product updated');
      } else {
        await apiCall('/api/tenant/products', { method: 'POST', body });
        showToast('Product created');
      }

      event.currentTarget.reset();
      setEditing(null);
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
          <h2>{editing ? 'Edit product' : 'Create product'}</h2>
        </div>
        <form className="form-stack" key={editing?.product_id || 'new'} onSubmit={handleSubmit}>
          <Field label="SKU"><input name="sku" defaultValue={editing?.sku || ''} /></Field>
          <Field label="Product name"><input name="productName" defaultValue={editing?.product_name || ''} required /></Field>
          <Field label="Category"><input name="category" defaultValue={editing?.category || ''} /></Field>
          <Field label="Description"><textarea name="description" defaultValue={editing?.description || ''} /></Field>
          <div className="form-grid">
            <Field label="Price"><input name="price" type="number" min="0" step="0.01" defaultValue={editing?.price ?? ''} required /></Field>
            <Field label="Stock"><input name="stockQuantity" type="number" min="0" step="1" defaultValue={editing?.stock_quantity ?? 0} /></Field>
          </div>
          <Field label="Status">
            <select name="status" defaultValue={editing?.status || 'AVAILABLE'}>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
            </select>
          </Field>
          <div className="button-row">
            <button className="button primary" disabled={submitting} type="submit">
              <Save size={18} />
              {submitting ? 'Saving...' : editing ? 'Save product' : 'Create product'}
            </button>
            {editing && (
              <button className="button subtle" onClick={() => setEditing(null)} type="button">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>Products</h2>
          <button className="icon-button" onClick={load} type="button" aria-label="Refresh products">
            <RefreshCcw size={17} />
          </button>
        </div>
        {products.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.product_id}>
                    <td>
                      <strong>{product.product_name}</strong>
                      <span className="subtext">{product.category || 'Uncategorized'}</span>
                    </td>
                    <td>{product.sku || ''}</td>
                    <td>{money(product.price)}</td>
                    <td>{product.stock_quantity}</td>
                    <td><StatusBadge status={product.status} /></td>
                    <td>
                      <button className="button compact" onClick={() => setEditing(product)} type="button">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>No products yet.</EmptyState>}
      </section>
    </section>
  );
}

function ReceiptView({ receipt, apiCall, showToast, reload }) {
  const [sending, setSending] = useState(false);

  const handleSend = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSending(true);
    try {
      await apiCall(`/api/tenant/transactions/${receipt.transaction_id}/send-email`, {
        method: 'POST',
        body: { recipientEmail: values.recipientEmail }
      });
      showToast('Receipt email sent');
      await reload();
    } catch (error) {
      showToast(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <article className="receipt-view">
      <header>
        <div>
          <h2>{receipt.tenant_name}</h2>
          <p>{receipt.address || 'Store receipt'}</p>
        </div>
        <div className="receipt-code">
          <strong>{receipt.receipt_code}</strong>
          <span>{receipt.transaction_date_display}</span>
        </div>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.detail_id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price)}</td>
                <td>{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        <StatusBadge status={receipt.email_status} />
        <strong>Total {money(receipt.total_amount)}</strong>
      </footer>
      <form className="email-row" onSubmit={handleSend}>
        <input name="recipientEmail" type="email" defaultValue={receipt.recipient_email || receipt.customer_email || ''} placeholder="customer@example.com" />
        <button className="button primary" disabled={sending} type="submit">
          <Send size={17} />
          {sending ? 'Sending...' : 'Send email'}
        </button>
      </form>
    </article>
  );
}

export function TransactionsPage({ apiCall, showToast, selectedTransactionId, setSelectedTransactionId }) {
  const [transactions, setTransactions] = useState([]);
  const [receipt, setReceipt] = useState(null);

  const loadTransactions = async () => {
    const response = await apiCall('/api/tenant/transactions');
    setTransactions(response.transactions);
  };

  const loadReceipt = async (transactionId = selectedTransactionId) => {
    if (!transactionId) {
      setReceipt(null);
      return;
    }

    const response = await apiCall(`/api/tenant/transactions/${transactionId}`);
    setReceipt(response.receipt);
  };

  useEffect(() => {
    loadTransactions().catch((error) => showToast(error.message));
  }, []);

  useEffect(() => {
    loadReceipt().catch((error) => showToast(error.message));
  }, [selectedTransactionId]);

  const selectTransaction = async (transactionId) => {
    setSelectedTransactionId(transactionId);
    await loadReceipt(transactionId);
  };

  const reloadReceiptAndTransactions = async () => {
    await Promise.all([loadTransactions(), loadReceipt()]);
  };

  return (
    <section className="split-layout">
      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>Transactions</h2>
          <button className="icon-button" onClick={loadTransactions} type="button" aria-label="Refresh transactions">
            <RefreshCcw size={17} />
          </button>
        </div>
        {transactions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>ID</th><th>Date</th><th>Customer</th><th>Total</th><th>Email</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.transaction_id}>
                    <td>#{transaction.transaction_id}</td>
                    <td>{shortDate(transaction.transaction_date)}</td>
                    <td>{transaction.customer_name || transaction.customer_email || 'Walk-in'}</td>
                    <td>{money(transaction.total_amount)}</td>
                    <td><StatusBadge status={transaction.email_status || 'NOT_SENT'} /></td>
                    <td>
                      <button className="button compact" onClick={() => selectTransaction(transaction.transaction_id)} type="button">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>No transactions yet.</EmptyState>}
      </section>

      <section className="panel">
        {receipt
          ? <ReceiptView receipt={receipt} apiCall={apiCall} showToast={showToast} reload={reloadReceiptAndTransactions} />
          : <EmptyState>Select a transaction to view receipt.</EmptyState>}
      </section>
    </section>
  );
}

export function TeamPage({ apiCall, showToast }) {
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const response = await apiCall('/api/tenant/users');
    setUsers(response.users);
  };

  useEffect(() => {
    load().catch((error) => showToast(error.message));
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    setSubmitting(true);
    try {
      await apiCall('/api/tenant/users', { method: 'POST', body });
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
          <h2>Create user</h2>
        </div>
        <form className="form-stack" onSubmit={handleCreate}>
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
          <button className="button primary" disabled={submitting} type="submit">
            <Save size={18} />
            {submitting ? 'Saving...' : 'Create user'}
          </button>
        </form>
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>Team</h2>
          <button className="icon-button" onClick={load} type="button" aria-label="Refresh team">
            <RefreshCcw size={17} />
          </button>
        </div>
        <UserTable users={users} />
      </section>
    </section>
  );
}

export function PaymentCheckoutPage({ apiCall, showToast, orderId, onPaymentComplete, onGoBack }) {
  const [order, setOrder] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [amountGiven, setAmountGiven] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!orderId) {
      onGoBack();
      return;
    }
    
    Promise.all([
      apiCall(`/api/tenant/orders/${orderId}`),
      apiCall('/api/tenant/orders/payment-methods')
    ])
      .then(([orderRes, pmRes]) => {
        setOrder(orderRes.order);
        const pms = pmRes.paymentMethods || ['CASH', 'BANK_CARD', 'BANK_TRANSFER', 'E_WALLET'];
        setPaymentMethods(pms);
        if (pms.length > 0) {
          setSelectedMethod(typeof pms[0] === 'string' ? pms[0] : pms[0].value);
        }
      })
      .catch((err) => {
        showToast(err.message);
        onGoBack();
      });
  }, [orderId]);

  const handlePayment = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    
    setSubmitting(true);
    try {
      const response = await apiCall(`/api/tenant/orders/${orderId}/payment`, {
        method: 'POST',
        body: {
          paymentMethod: values.paymentMethod,
          paymentReference: values.paymentReference || '',
          paymentNote: values.paymentNote || '',
          recipientEmail: values.recipientEmail || '',
          sendEmail: values.sendEmail === 'true'
        }
      });
      setOrder(response.order);
      setReceipt(response.receipt);
      showToast('Payment successful');
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    setCancelling(true);
    try {
      const response = await apiCall(`/api/tenant/orders/${orderId}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled at checkout' }
      });
      setOrder(response.order);
      showToast('Order cancelled');
    } catch (error) {
      showToast(error.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!order) return <EmptyState>Loading checkout...</EmptyState>;

  if (receipt) {
    return (
      <section className="panel wide-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="panel-heading">
          <h2>Payment Successful</h2>
        </div>
        <ReceiptView receipt={receipt} apiCall={apiCall} showToast={showToast} reload={() => {}} />
        <div className="button-row" style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <button className="button primary" onClick={onGoBack} type="button">
            Back to POS
          </button>
          <button className="button subtle" onClick={() => onPaymentComplete(receipt.transaction_id)} type="button">
            View Transactions
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="split-layout">
      <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-heading">
          <h2>Checkout Order #{order.transaction_id}</h2>
          <StatusBadge status={order.order_status} />
        </div>
        
        <div className="cart-list" style={{ marginTop: '1rem', flex: 1 }}>
          {order.items?.map((item) => (
            <div className="cart-line" key={item.detail_id || item.product_id}>
              <div>
                <strong>{item.product_name}</strong>
                <span>{item.quantity} x {money(item.unit_price)}</span>
              </div>
              <strong>{money(item.line_total)}</strong>
            </div>
          ))}
        </div>
        
        <div className="sale-total" style={{ borderTop: '2px dashed var(--border)' }}>
          <span>Total</span>
          <strong style={{ fontSize: '1.5rem' }}>{money(order.total_amount)}</strong>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="button subtle" onClick={onGoBack} type="button">
            <ArrowLeft size={16} /> Back to POS
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Payment Details</h2>
        </div>

        {(order.order_status === 'CANCELLED') ? (
          <EmptyState>This order has been cancelled.</EmptyState>
        ) : (
          <form className="form-stack" onSubmit={handlePayment} style={{ marginTop: '1rem' }}>
            <Field label="Payment Method">
              <select 
                name="paymentMethod" 
                required 
                value={selectedMethod} 
                onChange={(e) => setSelectedMethod(e.target.value)}
              >
                {paymentMethods.map(pm => {
                  const val = typeof pm === 'string' ? pm : pm.value;
                  const lbl = typeof pm === 'string' ? pm.replace('_', ' ') : pm.label;
                  return <option key={val} value={val}>{lbl}</option>;
                })}
              </select>
            </Field>

            {selectedMethod === 'CASH' && (
              <>
                <Field label="Amount Given by Customer">
                  <input 
                    name="amountGiven"
                    type="number" 
                    min={order.total_amount} 
                    step="0.01" 
                    placeholder="Enter amount" 
                    value={amountGiven}
                    onChange={(e) => setAmountGiven(e.target.value)}
                    required 
                  />
                </Field>
                {Number(amountGiven) >= order.total_amount && (
                  <div className="sale-total" style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '1rem' }}>
                    <span>Change Due</span>
                    <strong style={{ color: 'var(--success)', fontSize: '1.25rem' }}>
                      {money(Number(amountGiven) - order.total_amount)}
                    </strong>
                  </div>
                )}
              </>
            )}

            {selectedMethod === 'BANK_CARD' && (
              <div style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text)' }}>
                  💳 Please use the POS terminal to swipe the customer's card.
                </p>
              </div>
            )}

            {(selectedMethod === 'BANK_TRANSFER' || selectedMethod === 'E_WALLET') && (
              <div style={{ textAlign: 'center', marginBottom: '1rem', padding: '1rem', background: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <p style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text)' }}>
                  Scan QR to pay <strong>{money(order.total_amount)}</strong>
                </p>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ORDER_${order.transaction_id}_${order.total_amount}`} 
                  alt="QR Code" 
                  style={{ borderRadius: '8px', border: '1px solid var(--border)', display: 'inline-block' }} 
                />
              </div>
            )}

            
            {selectedMethod !== 'CASH' && (
              <>
                <Field label="Payment Reference (optional)">
                  <input name="paymentReference" placeholder="e.g. Bank transfer ID" />
                </Field>

                <Field label="Note (optional)">
                  <input name="paymentNote" />
                </Field>
              </>
            )}

            <Field label="Customer Email">
              <input name="recipientEmail" type="email" defaultValue={order.customer_email || ''} />
            </Field>

            <label className="check-row">
              <input name="sendEmail" type="checkbox" value="true" />
              <span>Send receipt email</span>
            </label>

            <div className="button-row">
              <button 
                className="button primary" 
                disabled={submitting || cancelling || (selectedMethod === 'CASH' && Number(amountGiven) < order.total_amount)} 
                type="submit"
              >
                <CreditCard size={18} />
                {submitting ? 'Processing...' : 'Confirm Payment'}
              </button>
              <button className="button subtle danger" disabled={submitting || cancelling} onClick={handleCancel} type="button" style={{ color: 'var(--danger)' }}>
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </form>
        )}
      </section>
    </section>
  );
}

export function InventoryPage({ apiCall, showToast }) {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [prodRes, movRes] = await Promise.all([
        apiCall('/api/tenant/inventory/products'),
        apiCall('/api/tenant/inventory/movements')
      ]);
      setProducts(prodRes.products || []);
      setMovements(movRes.movements || []);
    } catch (err) {
      showToast(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdjustment = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    
    setSubmitting(true);
    try {
      await apiCall('/api/tenant/inventory/adjustments', {
        method: 'POST',
        body: {
          productId: Number(values.productId),
          quantityChange: Number(values.quantityChange),
          movementType: values.movementType,
          note: values.note
        }
      });
      showToast('Inventory adjusted successfully');
      event.currentTarget.reset();
      setSelectedProduct(null);
      await loadData();
    } catch (error) {
      showToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="split-layout">
      <section className="panel wide-panel">
        <div className="panel-heading">
          <h2>Inventory Products</h2>
          <button className="icon-button" onClick={loadData} type="button" aria-label="Refresh inventory">
            <RefreshCcw size={17} />
          </button>
        </div>
        {products.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.product_id}>
                    <td><strong>{product.product_name}</strong></td>
                    <td>{product.sku || '-'}</td>
                    <td>{product.stock_quantity}</td>
                    <td><StatusBadge status={product.status} /></td>
                    <td>
                      <button className="button compact" onClick={() => setSelectedProduct(product)} type="button">
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>No products found.</EmptyState>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>{selectedProduct ? "Adjust " + selectedProduct.product_name : 'Stock Adjustment'}</h2>
        </div>
        
        {selectedProduct ? (
          <form className="form-stack" onSubmit={handleAdjustment}>
            <input type="hidden" name="productId" value={selectedProduct.product_id} />
            <Field label="Current Stock">
              <input value={selectedProduct.stock_quantity} disabled />
            </Field>
            <Field label="Movement Type">
              <select name="movementType" defaultValue="ADJUSTMENT">
                <option value="RESTOCK">RESTOCK (+)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (+/-)</option>
              </select>
            </Field>
            <Field label="Quantity Change">
              <input name="quantityChange" type="number" required placeholder="-5 or 10" />
            </Field>
            <Field label="Note">
              <input name="note" placeholder="Reason for adjustment" />
            </Field>
            
            <div className="button-row">
              <button className="button primary" disabled={submitting} type="submit">
                <Save size={18} /> {submitting ? 'Saving...' : 'Apply Adjustment'}
              </button>
              <button className="button subtle" onClick={() => setSelectedProduct(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <EmptyState>Select a product to adjust stock.</EmptyState>
        )}
        
        <div className="panel-heading" style={{ marginTop: '2rem' }}>
          <h2>Recent Movements</h2>
        </div>
        {movements.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Change</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 10).map((mov) => (
                  <tr key={mov.movement_id}>
                    <td>{mov.product_name}</td>
                    <td style={{ color: mov.quantity_change > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                      {mov.quantity_change > 0 ? '+' : ''}{mov.quantity_change}
                    </td>
                    <td><StatusBadge status={mov.movement_type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>No recent movements.</EmptyState>}
      </section>
    </section>
  );
}
