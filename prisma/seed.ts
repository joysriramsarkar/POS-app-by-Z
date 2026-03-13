import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🌱 Starting database seeding...");

    // Hash the admin password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Upsert the admin user (create if doesn't exist, update if it does)
    const adminUser = await (prisma as any).user.upsert({
      where: { username: "admin" },
      update: {
        password: hashedPassword,
        name: "Administrator",
      },
      create: {
        username: "admin",
        password: hashedPassword,
        name: "Administrator",
      },
    });

    console.log("✅ Admin user created/updated successfully:", {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
    });

    console.log("🎉 Database seeding completed!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
