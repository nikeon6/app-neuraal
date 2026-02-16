import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "test@neuraal.dev";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "TestPassword1!";
const E2E_DEV_USER_ID = process.env.E2E_DEV_USER_ID ?? "user-123";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for E2E seed");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("🌱 Seeding E2E auth user...");

    const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 12);

    await prisma.user.upsert({
      where: { email: E2E_USER_EMAIL },
      update: {
        passwordHash,
      },
      create: {
        email: E2E_USER_EMAIL,
        passwordHash,
      },
    });

    // Keep compatibility with DEV_USER header-based tests and seeded data ownership.
    await prisma.topic.upsert({
      where: {
        userId_name: { userId: E2E_DEV_USER_ID, name: "E2E Seed Topic" },
      },
      update: {},
      create: {
        userId: E2E_DEV_USER_ID,
        name: "E2E Seed Topic",
        color: "#3B82F6",
      },
    });

    console.log(`✅ E2E user ready: ${E2E_USER_EMAIL}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("E2E seed failed:", error);
  process.exit(1);
});
