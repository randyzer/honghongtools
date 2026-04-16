# Blog Article Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布一篇新的恋爱攻略文章到当前网站，并确认列表页和详情页都能正常展示。

**Architecture:** 复用现有博客 service 和 Neon 数据库，不新增后台或内容系统。实现上只做三件事：撰写文章内容、通过现有数据入口插入一条文章记录、再做页面级校验。

**Tech Stack:** TypeScript, Next.js App Router, Neon Postgres, Node.js scripts

---

### Task 1: 撰写并插入文章

**Files:**
- Read: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/lib/blog-service.ts`
- Read: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/storage/database/queries/app-queries.ts`
- No repo file changes required for insertion itself

- [ ] **Step 1: 准备文章字段**

确定以下字段：
- `title`
- `summary`
- `content`
- `author`
- `read_time`
- `tags`

- [ ] **Step 2: 通过现有 service 插入文章**

运行一段一次性 Node 命令，调用 `createArticle()` 新增文章。

- [ ] **Step 3: 记录返回的文章 id**

确认插入成功，并保留返回的 `id` 用于后续详情校验。

### Task 2: 验证网站展示

**Files:**
- Read: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/blog/page.tsx`
- Read: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/blog/[id]/page.tsx`

- [ ] **Step 1: 启动本地服务**

Run: `bash ./scripts/dev.sh`
Expected: 本地服务运行在 `http://127.0.0.1:5001`

- [ ] **Step 2: 校验博客列表页**

打开 `/blog`，确认新文章出现在列表中。

- [ ] **Step 3: 校验博客详情页**

打开 `/blog/<new-id>`，确认标题、摘要和正文正常展示。

- [ ] **Step 4: 关闭本地服务**

停止临时开发服务，避免留下后台进程。
