import { prisma } from "../config/prisma";

export const userRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  create: (data: { name: string; email: string; password: string }) =>
    prisma.user.create({ data }),
};
