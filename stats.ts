import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";

export const statsTable = pgTable("stats", {
  id: serial("id").primaryKey(),
  quantum_operations: integer("quantum_operations").notNull().default(0),
  deployments: integer("deployments").notNull().default(0),
  tests_passed_pct: real("tests_passed_pct").notNull().default(97.4),
  security_score: text("security_score").notNull().default("A+"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type Stats = typeof statsTable.$inferSelect;
