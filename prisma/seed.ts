import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with mock data...');

  const tenantId = 'test-tenant-id';
  
  // 1. Create a mock tenant owner
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.$executeRawUnsafe(`SET app.current_tenant = '${tenantId}'`);

  // Try to create or find owner
  let owner = await prisma.user.findUnique({ where: { email: 'owner@test.com' } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        tenant_id: tenantId,
        name: 'Demo Owner',
        email: 'owner@test.com',
        password: hashedPassword,
        role: 'OWNER',
        status: 'active'
      }
    });
  }

  // 2. Create Library (Branch)
  const library = await prisma.library.create({
    data: {
      tenant_id: tenantId,
      name: 'Main Campus Library',
      address: '123 Study Lane, Knowledge City',
      status: 'active'
    }
  });

  // 3. Create Floor
  const floor = await prisma.floor.create({
    data: {
      tenant_id: tenantId,
      library_id: library.library_id,
      name: 'First Floor',
      status: 'active'
    }
  });

  // 4. Create Room Type
  const roomType = await prisma.roomType.create({
    data: {
      tenant_id: tenantId,
      name: 'Premium AC Room'
    }
  });

  // 5. Create Reading Room
  const room = await prisma.readingRoom.create({
    data: {
      tenant_id: tenantId,
      library_id: library.library_id,
      floor_id: floor.floor_id,
      type_id: roomType.room_type_id,
      capacity: 50,
      status: 'active'
    }
  });

  // 6. Create Seats
  const seats = [];
  for (let i = 1; i <= 10; i++) {
    seats.push(await prisma.seat.create({
      data: {
        tenant_id: tenantId,
        room_id: room.room_id,
        seat_number: `A${i}`,
        status: 'vacant'
      }
    }));
  }

  // 7. Create Time Slots
  const morningSlot = await prisma.timeSlot.create({
    data: {
      tenant_id: tenantId,
      library_id: library.library_id,
      name: 'Morning Shift',
      start_time: '08:00',
      end_time: '14:00'
    }
  });

  const eveningSlot = await prisma.timeSlot.create({
    data: {
      tenant_id: tenantId,
      library_id: library.library_id,
      name: 'Evening Shift',
      start_time: '14:00',
      end_time: '20:00'
    }
  });

  // 8. Create Fee Plan
  const feePlan = await prisma.feePlan.create({
    data: {
      tenant_id: tenantId,
      library_id: library.library_id,
      name: 'Monthly Premium Access',
      billing_period: 'MONTHLY',
      amount: 1500.0,
      description: 'Access to premium AC rooms for morning shift',
      status: 'active'
    }
  });

  // 9. Create a Coordinator
  const coordPassword = await bcrypt.hash('coord123', 10);
  const coordinator = await prisma.coordinator.create({
    data: {
      tenant_id: tenantId,
      name: 'Jane Coordinator',
      mobile: '9876543210',
      password: coordPassword,
      status: 'active'
    }
  });

  // 10. Create a Student
  const studentPassword = await bcrypt.hash('student123', 10);
  const student = await prisma.student.create({
    data: {
      tenant_id: tenantId,
      name: 'Alice Student',
      mobile: '1234567890',
      parent_mobile: '1234567891',
      address: '456 Student Housing',
      college: 'Local University',
      password: studentPassword,
      status: 'active'
    }
  });

  console.log('Database seeded successfully!');
  console.log('--- TEST ACCOUNTS ---');
  console.log(`Owner Login: owner@test.com / admin123`);
  console.log(`Coordinator Mobile: 9876543210 / coord123`);
  console.log(`Student Mobile: 1234567890 / student123`);
  console.log(`Tenant ID: ${tenantId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
