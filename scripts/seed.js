import { pool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

const platformPassword = 'Admin@123';
const tenantPassword = 'Tenant@123';

const upsertPlatformAdmin = async () => {
  const passwordHash = await hashPassword(platformPassword);

  await pool.execute(
    `INSERT INTO platform_admins (full_name, username, email, password_hash)
     VALUES ('System Administrator', 'superadmin', 'admin@cloudpos.local', ?)
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       email = VALUES(email)`,
    [passwordHash]
  );
};

const upsertTenant = async ({ code, name, address, phone, email, ownerName }) => {
  await pool.execute(
    `INSERT INTO tenants (tenant_code, tenant_name, address, phone, email)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tenant_name = VALUES(tenant_name),
       address = VALUES(address),
       phone = VALUES(phone),
       email = VALUES(email),
       status = 'ACTIVE'`,
    [code, name, address, phone, email]
  );

  const [[tenant]] = await pool.execute(
    `SELECT tenant_id
     FROM tenants
     WHERE tenant_code = ?`,
    [code]
  );

  const passwordHash = await hashPassword(tenantPassword);

  await pool.execute(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role)
     VALUES (?, ?, 'owner', ?, ?, 'TENANT_ADMIN')
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       email = VALUES(email),
       role = 'TENANT_ADMIN',
       status = 'ACTIVE'`,
    [tenant.tenant_id, ownerName, `owner@${code}.local`, passwordHash]
  );

  return tenant.tenant_id;
};

const upsertProduct = async (tenantId, product) => {
  await pool.execute(
    `INSERT INTO products
      (tenant_id, sku, product_name, category, description, price, stock_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
     ON DUPLICATE KEY UPDATE
       product_name = VALUES(product_name),
       category = VALUES(category),
       description = VALUES(description),
       price = VALUES(price),
       stock_quantity = VALUES(stock_quantity),
       status = 'AVAILABLE'`,
    [
      tenantId,
      product.sku,
      product.name,
      product.category,
      product.description,
      product.price,
      product.stock
    ]
  );
};

const run = async () => {
  await upsertPlatformAdmin();

  const coffeeTenantId = await upsertTenant({
    code: 'coffeehouse',
    name: 'Cloud Coffee House',
    address: '12 Nguyen Hue Street',
    phone: '+84 900 111 222',
    email: 'hello@coffeehouse.local',
    ownerName: 'Coffee Owner'
  });

  const martTenantId = await upsertTenant({
    code: 'minimart',
    name: 'Mini Mart Saigon',
    address: '45 Le Loi Street',
    phone: '+84 900 333 444',
    email: 'hello@minimart.local',
    ownerName: 'Mini Mart Owner'
  });

  await Promise.all([
    upsertProduct(coffeeTenantId, {
      sku: 'CF-LATTE',
      name: 'Latte',
      category: 'Coffee',
      description: 'Espresso with steamed milk',
      price: 3.5,
      stock: 80
    }),
    upsertProduct(coffeeTenantId, {
      sku: 'CF-CROISSANT',
      name: 'Butter Croissant',
      category: 'Bakery',
      description: 'Fresh baked croissant',
      price: 2.25,
      stock: 40
    }),
    upsertProduct(coffeeTenantId, {
      sku: 'CF-COLD',
      name: 'Cold Brew',
      category: 'Coffee',
      description: 'Slow brewed coffee served chilled',
      price: 4,
      stock: 50
    }),
    upsertProduct(martTenantId, {
      sku: 'MM-WATER',
      name: 'Bottled Water',
      category: 'Drink',
      description: '500ml mineral water',
      price: 0.75,
      stock: 200
    }),
    upsertProduct(martTenantId, {
      sku: 'MM-SNACK',
      name: 'Potato Chips',
      category: 'Snack',
      description: 'Classic salted chips',
      price: 1.5,
      stock: 120
    }),
    upsertProduct(martTenantId, {
      sku: 'MM-MILK',
      name: 'Fresh Milk',
      category: 'Dairy',
      description: 'One liter fresh milk',
      price: 2.1,
      stock: 60
    })
  ]);

  console.log('Seed complete.');
  console.log(`Platform admin: superadmin / ${platformPassword}`);
  console.log(`Tenant users: owner / ${tenantPassword}`);
  console.log('Tenant codes: coffeehouse, minimart');
};

run()
  .catch((error) => {
    console.error('Seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
