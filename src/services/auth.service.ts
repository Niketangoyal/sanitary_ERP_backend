import { userRepository } from "../repositories/user.repository";
import { comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { LoginInput } from "../utils/validators/auth.schema";

export const authService = {
  async login({ email, password }: LoginInput) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found");
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  },
};
