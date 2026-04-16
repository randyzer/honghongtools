# Target Cursor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为网站接入一个全站生效、粉白适配、桌面端启用的 TargetCursor 特效。

**Architecture:** 新增一个独立的客户端光标组件，在全局布局中挂载一次。交互目标通过选择器自动识别，视觉样式通过全局 CSS 变量统一控制，移动端直接降级为不渲染。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, GSAP

---

### Task 1: 准备依赖与组件边界

**Files:**
- Modify: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/package.json`
- Create: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/components/TargetCursor.tsx`

- [ ] **Step 1: 安装 `gsap` 依赖**
- [ ] **Step 2: 写一个最小 failing test 或 smoke 验证策略**
- [ ] **Step 3: 基于你给的实现封装为项目内组件**
- [ ] **Step 4: 保持组件仅在客户端运行**

### Task 2: 做站点视觉适配

**Files:**
- Modify: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/globals.css`

- [ ] **Step 1: 增加 TargetCursor 颜色变量**
- [ ] **Step 2: 调整为粉白高对比配色**
- [ ] **Step 3: 确保桌面端隐藏默认光标，移动端不受影响**

### Task 3: 全局挂载与目标范围控制

**Files:**
- Modify: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/layout.tsx`

- [ ] **Step 1: 在根布局挂载 `TargetCursor`**
- [ ] **Step 2: 默认选择器覆盖按钮、链接、角色按钮和常见卡片**
- [ ] **Step 3: 保证不影响现有开发态 Inspector**

### Task 4: 验证与微调

**Files:**
- Test: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/components/TargetCursor.tsx`
- Test: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/layout.tsx`
- Test: `/Users/randyz/work/coding/deepsea_III/project/1st_demo_honghong/src/app/globals.css`

- [ ] **Step 1: 跑类型检查**
- [ ] **Step 2: 跑定向 lint**
- [ ] **Step 3: 启动本地站点做桌面端 hover smoke test**
- [ ] **Step 4: 确认首页、博客列表页、博客详情页都能正常显示光标特效**
