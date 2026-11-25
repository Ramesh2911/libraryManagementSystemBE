// One-time/upsert script: create or update the Web Admin (SUPER_ADMIN) account.
// Usage: npx tsx scripts/create-super-admin.ts [phone] [password] [name]
// Defaults: phone=9000000001 password=Admin@123 name=Web Admin
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

const phone = (process.argv[2] || '9000000001').replace(/\D/g, '');
const password = process.argv[3] || 'Admin@123';
const name = process.argv[4] || 'Web Admin';

if (phone.length < 10) {
  console.error('Invalid phone (need >=10 digits)');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters');
  process.exit(1);
}

(async () => {
  try {
    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.superAdminUser.upsert({
      where: { phone },
      update: { name, password: hashed, role: 'SUPER_ADMIN' },
      create: { name, phone, password: hashed, role: 'SUPER_ADMIN' },
    });
    console.log(`Super admin ready: phone=${admin.phone} name=${admin.name} id=${admin.admin_id}`);
    process.exit(0);
  } catch (err: any) {
    console.error('Failed to create super admin:', err.message || err);
    process.exit(1);
  }
})();
