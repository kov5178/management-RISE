import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  ListUsersResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(serialize(users)));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.insert(usersTable).values(parsed.data).returning();
  res.status(201).json(serialize(user));
});

export default router;
