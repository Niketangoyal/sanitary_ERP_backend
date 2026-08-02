import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { employeeService } from "../services/employee.service";

export const employeeController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await employeeService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await employeeService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await employeeService.create(req.body);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await employeeService.update(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await employeeService.remove(req.params.id);
    res.json({ success: true, message: "Employee deleted" });
  }),
};
