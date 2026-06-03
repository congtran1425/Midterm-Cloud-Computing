export function PaymentCheckoutPage({ apiCall, showToast, orderId, onPaymentComplete, onGoBack }) {
  const [order, setOrder] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!orderId) {
      onGoBack();
      return;
    }
    
    Promise.all([
      apiCall(/api/tenant/orders/$orderId),
      apiCall('/api/tenant/orders/payment-methods')
    ])
      .then(([orderRes, pmRes]) => {
        setOrder(orderRes.order);
        setPaymentMethods(pmRes.paymentMethods || ['CASH', 'BANK_TRANSFER']);
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
      const response = await apiCall(/api/tenant/orders/$orderId/payment, {
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
      const response = await apiCall(/api/tenant/orders/$orderId/cancel, {
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
      <section className="panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="panel-heading">
          <h2>Checkout Order #{order.transaction_id}</h2>
          <StatusBadge status={order.order_status} />
        </div>
        
        <div className="cart-list" style={{ marginTop: '1rem' }}>
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
        
        <div className="sale-total">
          <span>Total</span>
          <strong>{money(order.total_amount)}</strong>
        </div>

        {(order.order_status === 'CANCELLED') ? (
          <EmptyState>This order has been cancelled.</EmptyState>
        ) : (
          <form className="form-stack" onSubmit={handlePayment} style={{ marginTop: '1rem' }}>
            <Field label="Payment Method">
              <select name="paymentMethod" required>
                {paymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            
            <Field label="Payment Reference (optional)">
              <input name="paymentReference" placeholder="e.g. Bank transfer ID" />
            </Field>

            <Field label="Note (optional)">
              <input name="paymentNote" />
            </Field>

            <Field label="Customer Email">
              <input name="recipientEmail" type="email" defaultValue={order.customer_email || ''} />
            </Field>

            <label className="check-row">
              <input name="sendEmail" type="checkbox" value="true" />
              <span>Send receipt email</span>
            </label>

            <div className="button-row">
              <button className="button primary" disabled={submitting || cancelling} type="submit">
                <CreditCard size={18} />
                {submitting ? 'Processing...' : 'Confirm Payment'}
              </button>
              <button className="button subtle danger" disabled={submitting || cancelling} onClick={handleCancel} type="button" style={{ color: 'var(--danger)' }}>
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </form>
        )}
        
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="button subtle" onClick={onGoBack} type="button">
            <ArrowLeft size={16} /> Back to POS
          </button>
        </div>
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
