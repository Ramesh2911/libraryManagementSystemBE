// Upsert demo Student + Coordinator login accounts with known passwords.
// Usage:
//   npx tsx scripts/setup_demo_logins.ts
//   npx tsx scripts/setup_demo_logins.ts --student-mobile 9800000001 --student-password student123
//   npx tsx scripts/setup_demo_logins.ts --coord-mobile 9876500001 --coord-password coord123
// Env: DATABASE_URL (from .env). Idempotent — safe to re-run.
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';
import { MODULES } from '../src/config/modules';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const studentMobile = arg('student-mobile', '9800000001');
const studentPassword = arg('student-password', 'student123');
const studentName = arg('student-name', 'Demo Student');
const coordMobile = arg('coord-mobile', '9876500001');
const coordPassword = arg('coord-password', 'coord123');
const coordName = arg('coord-name', 'Demo Coordinator');

const fullPermissions = Object.fromEntries(MODULES.map((m) => [m, true]));

(async () => {
  try {
    if (studentMobile.length !== 10 || coordMobile.length !== 10) {
      console.error('Mobiles must be 10 digits');
      process.exit(1);
    }
    if (studentPassword.length < 6 || coordPassword.length < 6) {
      console.error('Passwords must be at least 6 characters');
      process.exit(1);
    }

    const studentHash = await bcrypt.hash(studentPassword, 10);
    const coordHash = await bcrypt.hash(coordPassword, 10);

    // Prefer tenant of owner 9876543210 when present (matches local + live demo tenant)
    const owner = await prisma.owner.findFirst({
      where: { contact: '9876543210' },
      select: { tenant_id: true },
    });
    const tenantId = owner?.tenant_id;

    // --- Student ---
    const existingStudent = await prisma.student.findFirst({
      where: { mobile: studentMobile },
      select: { student_id: true, tenant_id: true, name: true },
    });

    let student;
    if (existingStudent) {
      student = await prisma.student.update({
        where: { student_id: existingStudent.student_id },
        data: {
          password: studentHash,
          status: 'active',
          name: studentName,
        },
        select: { student_id: true, name: true, mobile: true, status: true, tenant_id: true },
      });
      console.log(`Student updated: ${student.mobile} (${student.name}) id=${student.student_id}`);
    } else {
      if (!tenantId) {
        console.error('No owner 9876543210 found — cannot pick tenant_id for new student');
        process.exit(1);
      }
      student = await prisma.student.create({
        data: {
          tenant_id: tenantId,
          name: studentName,
          mobile: studentMobile,
          password: studentHash,
          status: 'active',
        },
        select: { student_id: true, name: true, mobile: true, status: true, tenant_id: true },
      });
      console.log(`Student created: ${student.mobile} (${student.name}) id=${student.student_id}`);
    }

    // --- Coordinator ---
    const existingCoord = await prisma.coordinator.findFirst({
      where: { mobile: coordMobile },
      select: { coordinator_id: true, tenant_id: true, name: true },
    });

    let coord;
    if (existingCoord) {
      coord = await prisma.coordinator.update({
        where: { coordinator_id: existingCoord.coordinator_id },
        data: {
          password: coordHash,
          status: 'active',
          permissions: fullPermissions as any,
        },
        select: {
          coordinator_id: true,
          name: true,
          mobile: true,
          status: true,
          permissions: true,
          tenant_id: true,
        },
      });
      console.log(`Coordinator updated: ${coord.mobile} (${coord.name}) id=${coord.coordinator_id}`);
    } else {
      if (!tenantId) {
        console.error('No owner 9876543210 found — cannot pick tenant_id for new coordinator');
        process.exit(1);
      }
      coord = await prisma.coordinator.create({
        data: {
          tenant_id: tenantId,
          name: coordName,
          mobile: coordMobile,
          password: coordHash,
          permissions: fullPermissions as any,
          status: 'active',
        },
        select: {
          coordinator_id: true,
          name: true,
          mobile: true,
          status: true,
          permissions: true,
          tenant_id: true,
        },
      });
      console.log(`Coordinator created: ${coord.mobile} (${coord.name}) id=${coord.coordinator_id}`);
    }

    console.log('\n========== DEMO LOGIN DETAILS ==========');
    console.log('POST /api/v1/auth/login');
    console.log('');
    console.log('STUDENT');
    console.log(`  contact:  ${student.mobile}`);
    console.log(`  password: ${studentPassword}`);
    console.log(`  role:     STUDENT`);
    console.log(`  name:     ${student.name}  status=${student.status}`);
    console.log('');
    console.log('COORDINATOR');
    console.log(`  contact:    ${coord.mobile}`);
    console.log(`  password:   ${coordPassword}`);
    console.log(`  role:       COORDINATOR`);
    console.log(`  name:       ${coord.name}  status=${coord.status}`);
    console.log(`  permissions: ${JSON.stringify(coord.permissions)}`);
    console.log('');
    console.log('OWNER (existing)');
    console.log('  contact:  9876543210');
    console.log('  password: owner123');
    console.log('  role:     OWNER');
    console.log('=========================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
