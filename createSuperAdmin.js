// createSuperAdmin.js
import bcrypt from 'bcrypt';
import { prisma } from './prismaClient.js'; // החלף לפי הנתיב הנכון ל־Prisma או מסד הנתונים שלך

async function main() {
  const email = 'yannai.iluz@gmailcom'; // החלף למייל שלך
  const password = '123456'; // החלף לסיסמה שלך

  const hashedPassword = await bcrypt.hash(password, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email }
  });

  if (existingAdmin) {
    console.log('Admin already exists');
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'superadmin' // או לפי השדה שלך במסד
    }
  });

  console.log('Super admin created:', admin);
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit());
