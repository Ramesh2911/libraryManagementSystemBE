import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

(async () => {
  const hash = await bcrypt.hash('owner123', 10);
  const o = await prisma.owner.update({
    where: { contact: '9876543210' },
    data: { password: hash },
  });
  console.log('Owner password reset to owner123, tenant=' + o.tenant_id);
  process.exit(0);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
