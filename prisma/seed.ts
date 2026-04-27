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
        role: "ADMIN",
      },
      create: {
        username: "admin",
        password: hashedPassword,
        name: "Administrator",
        role: "ADMIN",
      },
    });

    console.log("✅ Admin user created/updated successfully:", {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
    });

    // Define all permissions
    const permissions = [
      // Users Management
      { code: "users.view", description: "View users list", category: "users" },
      { code: "users.create", description: "Create new user", category: "users" },
      { code: "users.edit", description: "Edit user details", category: "users" },
      { code: "users.delete", description: "Delete/deactivate user", category: "users" },

      // Products Management
      { code: "products.view", description: "View products", category: "products" },
      { code: "products.create", description: "Create product", category: "products" },
      { code: "products.edit", description: "Edit product", category: "products" },
      { code: "products.delete", description: "Delete product", category: "products" },

      // Sales Management
      { code: "sales.view", description: "View sales", category: "sales" },
      { code: "sales.create", description: "Create sale/checkout", category: "sales" },
      { code: "sales.edit", description: "Edit sale", category: "sales" },
      { code: "sales.delete", description: "Delete/cancel sale", category: "sales" },

      // Stock Management
      { code: "stock.view", description: "View stock", category: "stock" },
      { code: "stock.edit", description: "Update stock", category: "stock" },
      { code: "stock.import", description: "Import stock (bulk)", category: "stock" },

      // Reports
      { code: "reports.view", description: "View reports", category: "reports" },
      { code: "reports.export", description: "Export reports", category: "reports" },

      // Settings
      { code: "settings.view", description: "View settings", category: "settings" },
      { code: "settings.edit", description: "Edit settings", category: "settings" },

      // Customers
      { code: "customers.view", description: "View customers", category: "customers" },
      { code: "customers.create", description: "Create customer", category: "customers" },
      { code: "customers.edit", description: "Edit customer", category: "customers" },
    ];

    // Upsert permissions
    for (const permission of permissions) {
      await (prisma as any).permission.upsert({
        where: { code: permission.code },
        update: { description: permission.description },
        create: permission,
      });
    }

    console.log("✅ Permissions seeded successfully");

    // Define role permissions
    const rolePermissions = {
      ADMIN: [
        // Admin has all permissions
        "users.view", "users.create", "users.edit", "users.delete",
        "products.view", "products.create", "products.edit", "products.delete",
        "sales.view", "sales.create", "sales.edit", "sales.delete",
        "stock.view", "stock.edit", "stock.import",
        "reports.view", "reports.export",
        "settings.view", "settings.edit",
        "customers.view", "customers.create", "customers.edit",
      ],
      MANAGER: [
        // Manager can do most things except user management and settings
        "products.view", "products.create", "products.edit",
        "sales.view", "sales.create", "sales.edit",
        "stock.view", "stock.edit", "stock.import",
        "reports.view", "reports.export",
        "customers.view", "customers.create", "customers.edit",
      ],
      CASHIER: [
        // Cashier can only do sales, view products and customers
        "products.view",
        "sales.view", "sales.create",
        "customers.view", "customers.create",
      ],
      VIEWER: [
        // Viewer can only view reports
        "reports.view",
        "products.view",
        "sales.view",
      ],
    };

    // Clear existing role permissions
    await (prisma as any).rolePermission.deleteMany({});

    // Seed role permissions
    for (const [role, codes] of Object.entries(rolePermissions)) {
      for (const code of codes) {
        const permission = await (prisma as any).permission.findUnique({
          where: { code },
        });
        if (permission) {
          await (prisma as any).rolePermission.create({
            data: {
              role,
              permissionId: permission.id,
            },
          });
        }
      }
    }

    console.log("✅ Role permissions seeded successfully");

    console.log("🎉 Database seeding completed!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
