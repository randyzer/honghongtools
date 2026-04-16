import { pgTable, serial, timestamp, text, varchar, integer, index, uniqueIndex } from "drizzle-orm/pg-core"

// 系统表 - 禁止删除
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
  "users",
  {
    id: serial().primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_username_unique").on(table.username),
  ]
);

// 类型推断
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 博客文章表
export const blogPosts = pgTable(
  "blog_post",
  {
    id: serial().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    author: varchar("author", { length: 100 }).notNull().default("恋爱教练小王"),
    read_time: varchar("read_time", { length: 20 }).notNull().default("3分钟"),
    tags: text("tags").notNull().default("[]"), // JSON 数组字符串
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("blog_post_created_at_idx").on(table.created_at),
  ]
);

// 类型推断
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

// 游戏记录表
export const gameRecords = pgTable(
  "game_records",
  {
    id: serial().primaryKey(),
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scenario: varchar("scenario", { length: 100 }).notNull(),
    final_score: integer("final_score").notNull(),
    result: varchar("result", { length: 20 }).notNull(), // 'success' | 'failed'
    played_at: timestamp("played_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("game_records_user_id_idx").on(table.user_id),
    index("game_records_played_at_idx").on(table.played_at),
  ]
);

// 类型推断
export type GameRecord = typeof gameRecords.$inferSelect;
export type InsertGameRecord = typeof gameRecords.$inferInsert;
