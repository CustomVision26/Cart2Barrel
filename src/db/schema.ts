import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  phone: text("phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  cityOrTown: text("city_or_town"),
  parish: text("parish"),
  country: text("country").notNull().default("Jamaica"),
  profileCompletedAt: timestamp("profile_completed_at", {
    withTimezone: true,
    mode: "string",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
