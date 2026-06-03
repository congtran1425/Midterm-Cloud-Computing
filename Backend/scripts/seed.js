import { pool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

const platformPassword = 'Admin@123';
const tenantPassword = 'Tenant@123';
const staffPassword = 'Staff@123';

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

const upsertTenantUser = async (tenantId, tenantCode, user) => {
  await pool.execute(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       email = VALUES(email),
       role = VALUES(role),
       status = 'ACTIVE'`,
    [
      tenantId,
      user.fullName,
      user.username,
      `${user.username}@${tenantCode}.local`,
      await hashPassword(staffPassword),
      user.role || 'STAFF'
    ]
  );
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

  const coffeeProducts = [
    {
      sku: 'CF-LATTE',
      name: 'Latte',
      category: 'Coffee',
      description: 'Espresso with steamed milk',
      price: 3.5,
      stock: 80
    },
    {
      sku: 'CF-CROISSANT',
      name: 'Butter Croissant',
      category: 'Bakery',
      description: 'Fresh baked croissant',
      price: 2.25,
      stock: 40
    },
    {
      sku: 'CF-COLD',
      name: 'Cold Brew',
      category: 'Coffee',
      description: 'Slow brewed coffee served chilled',
      price: 4,
      stock: 50
    },
    {
      sku: 'CF-ESPRESSO',
      name: 'Espresso',
      category: 'Coffee',
      description: 'Single shot espresso',
      price: 2.5,
      stock: 100
    },
    {
      sku: 'CF-CAPPUCCINO',
      name: 'Cappuccino',
      category: 'Coffee',
      description: 'Espresso with foamed milk',
      price: 3.75,
      stock: 75
    },
    {
      sku: 'CF-MOCHA',
      name: 'Mocha',
      category: 'Coffee',
      description: 'Chocolate espresso drink',
      price: 4.25,
      stock: 65
    },
    {
      sku: 'CF-MATCHA',
      name: 'Matcha Latte',
      category: 'Tea',
      description: 'Matcha with steamed milk',
      price: 4.1,
      stock: 55
    },
    {
      sku: 'CF-BAGEL',
      name: 'Cream Cheese Bagel',
      category: 'Bakery',
      description: 'Toasted bagel with cream cheese',
      price: 3.2,
      stock: 35
    },
    {
      sku: 'CF-BROWNIE',
      name: 'Chocolate Brownie',
      category: 'Dessert',
      description: 'Rich chocolate brownie',
      price: 2.8,
      stock: 45
    },
    {
      sku: 'CF-TEA',
      name: 'Lemon Iced Tea',
      category: 'Tea',
      description: 'Fresh iced tea with lemon',
      price: 2.6,
      stock: 70
    }
  ];

  const martProducts = [
    {
      sku: 'MM-WATER',
      name: 'Bottled Water',
      category: 'Drink',
      description: '500ml mineral water',
      price: 0.75,
      stock: 200
    },
    {
      sku: 'MM-SNACK',
      name: 'Potato Chips',
      category: 'Snack',
      description: 'Classic salted chips',
      price: 1.5,
      stock: 120
    },
    {
      sku: 'MM-MILK',
      name: 'Fresh Milk',
      category: 'Dairy',
      description: 'One liter fresh milk',
      price: 2.1,
      stock: 60
    },
    {
      sku: 'MM-COLA',
      name: 'Cola Can',
      category: 'Drink',
      description: '330ml cola can',
      price: 1.05,
      stock: 150
    },
    {
      sku: 'MM-JUICE',
      name: 'Orange Juice',
      category: 'Drink',
      description: 'Fresh orange juice bottle',
      price: 1.9,
      stock: 90
    },
    {
      sku: 'MM-BREAD',
      name: 'Sandwich Bread',
      category: 'Bakery',
      description: 'Soft white sandwich bread',
      price: 2.3,
      stock: 50
    },
    {
      sku: 'MM-EGGS',
      name: 'Chicken Eggs',
      category: 'Grocery',
      description: 'Pack of 10 eggs',
      price: 3.4,
      stock: 45
    },
    {
      sku: 'MM-NOODLE',
      name: 'Instant Noodles',
      category: 'Grocery',
      description: 'Chicken flavor instant noodles',
      price: 0.65,
      stock: 180
    },
    {
      sku: 'MM-SOAP',
      name: 'Hand Soap',
      category: 'Household',
      description: 'Liquid hand soap bottle',
      price: 2.6,
      stock: 70
    },
    {
      sku: 'MM-TISSUE',
      name: 'Tissue Box',
      category: 'Household',
      description: 'Soft facial tissues',
      price: 1.2,
      stock: 110
    }
  ];

  const tenantUsers = [
    {
      tenantId: coffeeTenantId,
      tenantCode: 'coffeehouse',
      users: [
        { username: 'cashier1', fullName: 'Coffee Cashier One' },
        { username: 'cashier2', fullName: 'Coffee Cashier Two' },
        { username: 'barista', fullName: 'Coffee Barista' }
      ]
    },
    {
      tenantId: martTenantId,
      tenantCode: 'minimart',
      users: [
        { username: 'cashier1', fullName: 'Mini Mart Cashier One' },
        { username: 'cashier2', fullName: 'Mini Mart Cashier Two' },
        { username: 'stockstaff', fullName: 'Mini Mart Stock Staff' }
      ]
    }
  ];

  await Promise.all([
    ...coffeeProducts.map((product) => upsertProduct(coffeeTenantId, product)),
    ...martProducts.map((product) => upsertProduct(martTenantId, product)),
    ...tenantUsers.flatMap((tenant) => tenant.users.map((user) => (
      upsertTenantUser(tenant.tenantId, tenant.tenantCode, user)
    )))
  ]);

  console.log('Seed complete.');
  console.log(`Platform admin: superadmin / ${platformPassword}`);
  console.log(`Tenant users: owner / ${tenantPassword}`);
  console.log(`Tenant staff users: cashier1, cashier2, barista, stockstaff / ${staffPassword}`);
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
