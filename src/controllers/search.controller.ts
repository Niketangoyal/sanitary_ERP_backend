import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { searchService } from "../services/search.service";

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchService.globalSearch(query);
    res.json({ success: true, data: results });
  }),
};
