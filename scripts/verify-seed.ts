import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = await prisma.role.findMany({ select: { name: true, isBuiltIn: true, permissions: true } });
  console.log("Roles:", JSON.stringify(roles, null, 2));

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  console.log("Settings:", JSON.stringify(settings));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
