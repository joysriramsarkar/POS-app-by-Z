import { createClient } from "@supabase/supabase-js";
import * as sqlite3 from "sqlite3";
import * as path from "path";
import * as fs from "fs";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const sqliteDbPath = path.join(process.cwd(), "data", "pos.db");

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  try {
    console.log("🔄 Starting data migration from SQLite to PostgreSQL...");

    // Check if SQLite database exists
    if (!fs.existsSync(sqliteDbPath)) {
      console.log("⚠️  SQLite database not found at", sqliteDbPath);
      console.log("✅ No data to migrate. Starting fresh with Supabase.");
      return;
    }

    console.log("📂 Found SQLite database at:", sqliteDbPath);

    const db = new sqlite3.Database(sqliteDbPath);

    // Migrate each table
    await migrateTable(db, "users");
    await migrateTable(db, "products");
    await migrateTable(db, "categories");
    await migrateTable(db, "customers");
    await migrateTable(db, "sales");
    await migrateTable(db, "sale_items");
    await migrateTable(db, "stock_history");
    await migrateTable(db, "ledger_entries");
    await migrateTable(db, "suppliers");
    await migrateTable(db, "purchases");
    await migrateTable(db, "purchase_items");
    await migrateTable(db, "sync_queue");
    await migrateTable(db, "settings");

    db.close();

    console.log("✅ Data migration completed successfully!");
    console.log("🎉 All tables have been migrated to PostgreSQL!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

async function migrateTable(db: sqlite3.Database, tableName: string) {
  return new Promise<void>((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, async (err, rows: any[]) => {
      if (err) {
        if (err.message.includes("no such table")) {
          console.log(`⏭️  Table '${tableName}' not found in SQLite, skipping...`);
          resolve();
          return;
        }
        console.error(`❌ Error reading ${tableName}:`, err);
        reject(err);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log(`⏭️  Table '${tableName}' is empty, skipping...`);
        resolve();
        return;
      }

      try {
        // Insert data into PostgreSQL
        const { error } = await supabase.from(tableName).insert(rows);

        if (error) {
          console.error(`❌ Error inserting into ${tableName}:`, error);
          reject(error);
          return;
        }

        console.log(`✅ Migrated ${rows.length} records from '${tableName}'`);
        resolve();
      } catch (error) {
        console.error(`❌ Error migrating ${tableName}:`, error);
        reject(error);
      }
    });
  });
}

migrateData();
