import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@erp.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";
  const adminName = process.env.ADMIN_NAME ?? "Administrator";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: { name: adminName, email: adminEmail, password: hashed, role: "ADMIN" },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const existingSettings = await prisma.settings.findFirst();
  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        businessName: "Sanitary & Bathroom Fittings",
        address: "",
        gstNumber: "",
        phone: "",
        email: adminEmail,
        invoicePrefix: "INV",
        returnPrefix: "RET",
        paymentPrefix: "PAY",
        invoiceFooter: "Thank you for your business.",
        theme: "light",
      },
    });
    console.log("Created default settings");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
