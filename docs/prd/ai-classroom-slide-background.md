# PRD：AI 课堂幻灯片背景（参考图 / 模版库 / 编辑页页背景）

**文档状态**：已与当前实现同步（2026-05）  
**范围**：首页创建入口、服务端异步生成、幻灯片编辑模式画布背景

---

## 1. 背景与目标

用户在 AI 课堂中希望幻灯片支持**整页背景**：创建时可带统一视觉参考；编辑时可在封面/封底类页面更换本页背景。目标为：

- 降低与 PowerPoint「母版感」的认知差距；
- 生成阶段将内容排版在用户选定底图之上；
- 常用背景可复用，减少重复上传。

---

## 2. 功能概述

| 模块 | 能力 |
|------|------|
| **首页** | 参考背景**模版库**（本地持久化）、**本次生成选用**、工具栏 **+数字角标**（模版数量） |
| **服务端生成** | `POST /api/generate-classroom` 可选携带整页参考图；所有 **`slide` 类型场景**强制使用该图作为画布 `background.type=image` |
| **编辑页** | 仅**课程第一页与最后一页**的幻灯片场景：插入工具条内提供**页背景**上传；有图片背景时提供**铺满 / 适应** |

---

## 3. 首页：参考背景模版库

### 3.1 入口与展示

- 位置：主输入卡片**底部工具栏**，与「图书/附件」上传中心并列。
- 形态：**圆形 `+` 按钮** + 角标数字 = **当前模版库中已保存的背景张数**（0 时不显示角标）。
- 若本次已勾选某模版用于生成：按钮为**紫色高亮态**（与已选附件态一致）。

### 3.2 弹层（Popover）

- 风格对齐**图书库**：顶栏标题、可滚动内容区、上传入口 + 模版网格。
- **上传并保存到模版库**：校验类型与大小后写入本地存储，并**自动设为本次使用**。
- **模版卡片**：缩略图、名称；**复选框**表示「本次生成使用」（单选逻辑）；**删除**从库中移除（若删除的是当前选用，清空本次选用）。
- **取消本次选用的背景**：仅取消勾选，不删库。

### 3.3 数据与约束

- **存储**：`localStorage`，键名见实现常量 `REFERENCE_BG_TEMPLATES_STORAGE_KEY`。
- **单条模版**：`id`、`name`、`dataUrl`、`createdAt`。
- **上限**：`MAX_REFERENCE_BG_TEMPLATES`（默认 24）；满则提示先删旧模版。
- **图片**：JPG / PNG / WebP / GIF；单文件不超过 **2MB**（与 `MAX_REFERENCE_BACKGROUND_BYTES` 一致）。

### 3.4 与「进入课堂」衔接

- 用户点击「进入课堂」时：若存在**本次选用**的 `dataUrl`，写入 `sessionStorage`（键 `REFERENCE_BACKGROUND_SESSION_KEY`），供后续接入真实生成请求时读取，作为请求体字段 **`referenceBackgroundImage`**。
- 当前演示流仍以跳转演示课堂为主；**正式环境**需在调用 `POST /api/generate-classroom` 时从 sessionStorage 或状态机带入该字段。

---

## 4. 服务端：课堂生成与参考背景

### 4.1 API

- **`POST /api/generate-classroom`**  
  - 可选字段：`referenceBackgroundImage`（`string`）  
  - 取值：`data:image/...;base64,...` 或 `https://...`  
  - 服务端对字符串长度做上限（防止超大 body，实现中约 3.5M 字符级）。

### 4.2 生成行为

- 在 `GenerateClassroomInput` 中传入 `referenceBackgroundImage` 时，对每个 **`outline.type === 'slide'`** 的场景：
  - 将该图作为 **vision 输入的首张图**（固定 id：`user_reference_slide_background`），供模型理解构图与对比度；
  - 解析幻灯片 JSON 后，**强制**设置 `canvas.background = { type: 'image', image: { src, size: 'cover' } }`，覆盖模型自行输出的纯色/渐变背景（避免与用户底图冲突）。
- **Prompt**：通过 `referenceBackgroundActive` 条件注入 `slide-reference-background` 片段及 `slide-content` user 模板补充说明，引导模型仅在 `elements` 中排版、勿整页重复铺底图。

### 4.3 类型与解析

- `GeneratedSlideData.background` 支持 `image` 类型，便于未来模型直接输出图片背景时的解析；有参考图时仍以服务端覆盖为准。

---

## 5. 编辑页：页背景（首 / 末页幻灯片）

### 5.1 显示条件

- **编辑模式**已开启；
- 当前场景为 **`slide`**；
- 当前场景在整课列表中为**第一页或最后一页**（按 `scenes` 顺序下标 0 与 `length-1`）。

### 5.2 工具条集成

- **不再使用**独立紫色横条；与「文本 / 图片 / 视频 / 表格」同一**浮动插入工具条**，以竖线分隔。
- **页背景**：打开文件选择，上传成功后设为 `background.type=image`（保留当前铺满/适应偏好逻辑中的 size）。
- **铺满 / 适应**：仅当当前背景已为图片时显示，对应 `image.size` 为 `cover` / `contain`。
- **已移除**：「恢复纯色 / 主题色」入口（产品决策：仅保留图片页背景与适配方式）。

### 5.3 文案（中文）

- 按钮短标签：`页背景`
- 悬停说明：`可上传图片，更换本页幻灯片背景。`（键：`editMode.slideCanvasBg.pageBgTooltip`）

---

## 6. 国际化与工程文件

- 文案键：`home.referenceBg.*`（模版库）、`editMode.insertToolbar.slideBg`、`editMode.slideCanvasBg.pageBgTooltip` / `fitCover` / `fitContain` 等。
- 主要实现文件（维护时可检索）：
  - `app/page.tsx` — 首页入口与 sessionStorage
  - `components/publisher/reference-background-library-dialog.tsx` — 模版库弹层
  - `lib/utils/reference-background-library-storage.ts` — 模版持久化
  - `lib/constants/reference-background.ts` — 常量
  - `lib/server/classroom-generation.ts`、`app/api/generate-classroom/route.ts` — 入参透传
  - `lib/generation/scene-generator.ts` — vision + 背景覆盖
  - `lib/prompts/snippets/slide-reference-background.md`、`lib/prompts/templates/slide-content/*`
  - `components/slide-renderer/Editor/slide-edit-insert-toolbar.tsx` — 编辑页页背景

---

## 7. 验收要点（建议）

1. 首页：上传多张模版 → 角标递增；勾选一张 → 进入课堂前 sessionStorage 有对应 dataUrl。
2. 带 `referenceBackgroundImage` 调用生成 API → 每个 slide 场景画布背景为图且元素在上层可读。
3. 编辑演示课：首末页幻灯片可见「页背景」与铺满/适应；中间页无该组控件。
4. 无参考图生成：行为与改造前一致。

---

## 8. 后续可选（未强制入本期 PRD）

- 首页提交任务时**自动**将 `sessionStorage` 中的参考图并入 `POST /api/generate-classroom`（需替换当前纯前端跳转演示流）。
- 模版库同步到账号云端（当前仅本机 `localStorage`）。
