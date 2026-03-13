const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

// SQLite ডাটাবেসের পাথ তৈরি করা হচ্ছে (src/lib/db.ts এর মতো)
const dbPath = path.resolve(__dirname, 'data', 'pos.db');
const databaseUrl = process.env.DATABASE_URL || `file:${dbPath.replace(/\\/g, '/')}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function main() {
  // পাসওয়ার্ড '123456' এর জন্য হ্যাশ তৈরি করা হচ্ছে
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  try {
    // Check if the 'user' model is accessible
    if (!prisma.user) {
      console.error("❌ Error: 'prisma.user' is undefined.");
      console.log("আপনার schema.prisma ফাইলে মডেলের নাম কি 'User'? যদি অন্য কিছু হয় (যেমন 'Admin' বা 'Staff'), তবে এই স্ক্রিপ্টে 'prisma.user' এর বদলে সেটি ব্যবহার করুন।");
      console.log("টিপস: 'npx prisma generate' কমান্ডটি রান করে আবার চেষ্টা করুন।");
      return;
    }
    const user = await prisma.user.upsert({
      where: { username: 'admin' },
      update: { password: hashedPassword }, // যদি ইউজার আগে থেকেই থাকে, পাসওয়ার্ড রিসেট হবে
      create: {
        username: 'admin',
        name: 'System Admin',
        password: hashedPassword,
        // আপনার ডাটাবেস স্কিমাতে যদি role ফিল্ড থাকে তবে নিচের লাইনটি আনকমেন্ট করুন
        // role: 'ADMIN', 
      },
    });
    console.log('✅ অ্যাডমিন ইউজার তৈরি সফল হয়েছে!');
    console.log('Username: admin');
    console.log('Password: 123456');
  } catch (e) {
    console.error('❌ ইউজার তৈরি করতে সমস্যা হয়েছে:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
