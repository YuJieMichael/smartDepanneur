import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roles = ['Admin', 'Store Owner', 'Cashier', 'Inventory Staff', 'Applicant', 'Project Owner'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded roles:', roles);

  const adminEmail = 'admin@smartdepanneur.local';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      roles: { set: [{ name: 'Admin' }] },
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      roles: { connect: [{ name: 'Admin' }] },
    },
  });

  console.log('Seeded admin user:', adminEmail);

  await prisma.dictionary.upsert({
    where: { key: 'roleoptions' },
    update: { value: roles },
    create: { key: 'roleoptions', value: roles },
  });

  console.log('Seeded dictionary: roleoptions');

  await prisma.dictionary.upsert({
    where: { key: 'poststate' },
    update: { value: ['active', 'closed'] },
    create: { key: 'poststate', value: ['active', 'closed'] },
  });

  console.log('Seeded dictionary: poststate');

  // Seed permissions and assign to Admin role
  const permissions = [
    'create-permission',
    'edit-permission',
    'create-user',
    'edit-user',
    'view-admin',
    'edit-role',
    'template-edit',
    'edit-dictionary',
    'post-edit',
    'post-view',
    'product-edit',
    'inventory-edit',
    'sales-edit',
    'dashboard-view',
    'insights-view',
  ];

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {
        roles: { connect: { name: 'Admin' } },
      },
      create: {
        name,
        roles: { connect: { name: 'Admin' } },
      },
    });
  }

  // Assign store permissions to operational roles.
  for (const perm of ['product-edit', 'inventory-edit', 'sales-edit', 'dashboard-view', 'insights-view']) {
    await prisma.permission.update({
      where: { name: perm },
      data: { roles: { connect: [{ name: 'Store Owner' }] } },
    });
  }

  for (const perm of ['sales-edit', 'dashboard-view']) {
    await prisma.permission.update({
      where: { name: perm },
      data: { roles: { connect: [{ name: 'Cashier' }] } },
    });
  }

  for (const perm of ['product-edit', 'inventory-edit', 'dashboard-view', 'insights-view']) {
    await prisma.permission.update({
      where: { name: perm },
      data: { roles: { connect: [{ name: 'Inventory Staff' }] } },
    });
  }

  // Keep the legacy recruitment demo roles usable for old routes.
  for (const perm of ['post-view', 'post-edit', 'template-edit']) {
    await prisma.permission.update({
      where: { name: perm },
      data: { roles: { connect: { name: 'Project Owner' } } },
    });
  }

  console.log('Seeded permissions:', permissions);

  // Clean up orphan permissions not in the list
  await prisma.permission.deleteMany({
    where: { name: { notIn: permissions } },
  });

  // Seed country and state dictionaries
  const countryStateMap = {
    'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Northern Territory', 'Australian Capital Territory'],
    'United States': ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Washington', 'Massachusetts'],
    'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick'],
    'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    'New Zealand': ['Auckland', 'Wellington', 'Canterbury', 'Waikato', 'Bay of Plenty', 'Otago'],
  };

  const countries = Object.keys(countryStateMap);
  await prisma.dictionary.upsert({
    where: { key: 'country' },
    update: { value: countries, category: 'template' },
    create: { key: 'country', value: countries, category: 'template' },
  });

  for (const [country, states] of Object.entries(countryStateMap)) {
    const stateKey = `state_${country}`;
    await prisma.dictionary.upsert({
      where: { key: stateKey },
      update: { value: states, category: 'template' },
      create: { key: stateKey, value: states, category: 'template' },
    });
  }

  console.log('Seeded country/state dictionaries');

  const categorySeeds = [
    { name: 'Drinks', code: 'DRINKS' },
    { name: 'Snacks', code: 'SNACKS' },
    { name: 'Dairy', code: 'DAIRY' },
    { name: 'Household', code: 'HOUSEHOLD' },
  ];

  for (const category of categorySeeds) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { code: category.code },
      create: category,
    });
  }

  console.log('Seeded categories:', categorySeeds.map((category) => category.name));

  const supplierSeeds = [
    {
      name: 'Metro Beverage Supply',
      contactName: 'Martin Roy',
      phone: '514-555-0101',
      email: 'orders@metrobeverage.example',
      notes: 'Weekly beverage restocking supplier',
    },
    {
      name: 'QuickSnack Wholesale',
      contactName: 'Nina Chen',
      phone: '514-555-0102',
      email: 'sales@quicksnack.example',
      notes: 'Snacks and impulse-purchase items',
    },
    {
      name: 'Nordic Dairy Distributors',
      contactName: 'Alex Gagnon',
      phone: '514-555-0103',
      email: 'dispatch@nordicdairy.example',
      notes: 'Short-shelf-life refrigerated products',
    },
  ];

  for (const supplier of supplierSeeds) {
    await prisma.supplier.upsert({
      where: { name: supplier.name },
      update: {
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
        notes: supplier.notes,
      },
      create: supplier,
    });
  }

  console.log('Seeded suppliers:', supplierSeeds.map((supplier) => supplier.name));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

