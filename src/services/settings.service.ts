import { settingsRepository } from "../repositories/settings.repository";
import { UpdateSettingsInput } from "../utils/validators/settings.schema";

export const settingsService = {
  /** Settings is a singleton row, lazily created on first read/write. */
  async getOrCreate() {
    const existing = await settingsRepository.findFirst();
    if (existing) return existing;
    return settingsRepository.create({ businessName: "My Business" });
  },

  async update(input: UpdateSettingsInput & { logoUrl?: string }) {
    const settings = await settingsService.getOrCreate();
    return settingsRepository.update(settings.id, input);
  },
};
