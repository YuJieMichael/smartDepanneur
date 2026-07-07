import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = ['Applicant', 'Project Owner', 'Admin'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded roles:', roles);

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

  console.log('Seeded permissions:', permissions);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
