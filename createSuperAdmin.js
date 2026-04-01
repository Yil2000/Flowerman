import bcrypt from 'bcrypt';
import { prisma } from './prismaClient.js'; // או החלף עם חיבור מסד הנתונים שלך

async function main() {
  const email = 'yannai.iluz@gmail.com'; // החלף למייל שלך
  const password = '123456'; // החלף לסיסמה שלך
  const fullname = 'ינאי אילוז'; // שם מלא
  const role = 'superadmin'; // תמיד סופר־אדמין

  const hashedPassword = await bcrypt.hash(password, 10);

  // אם אתה משתמש ב־Prisma
  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    console.log('משתמש כבר קיים!');
    return;
  }

  const user = await prisma.user.create({
    data: {
      fullname,
      email,
      password: hashedPassword,
      role
    }
  });

  console.log('סופר־אדמין נוצר בהצלחה:', user);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
