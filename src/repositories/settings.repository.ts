import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const settingsRepository = {
  findFirst: () => prisma.settings.findFirst(),
  create: (data: Prisma.SettingsCreateInput) => prisma.settings.create({ data }),
  update: (id: string, data: Prisma.SettingsUpdateInput) =>
    prisma.settings.update({ where: { id }, data }),
};
