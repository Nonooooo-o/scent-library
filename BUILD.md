# 构建说明（给云端构建用）

## 安装与构建

```bash
npm install        # 或 npm ci（带了 package-lock.json）
npm run build
```

注意：构建用的是 `vite build --config vite.spa.config.mjs`，
不是默认的 `vite build`，也不是 `next build`
（`next.config.mjs` / `app/` 是早期迭代残留，不参与构建）。

`npm run build` 实际做三件事：
1. `node scripts/validate-world-cutouts.mjs` —— 校验世界切图覆盖率
2. `vite build --config vite.spa.config.mjs` —— 构建，产物在 `dist/client/`
3. `node scripts/prune-deploy-assets.mjs` —— 删除产物里的原图，瘦身

## 关于图片（本包没带的原因）

`public/thumbnails/`（318MB）和 `public/perfumes/`（277MB）太大，没进这个包。

- 只改文字 / 数据 / 评分 / 样式时：把已部署文件夹里的 `thumbnails/` 复制到源码 `public/` 下，再跑 `npm run build`，第一步校验就能通过（推荐）。
- 手头没有 thumbnails 时：跳过第一步，直接跑 `npx vite build --config vite.spa.config.mjs`（仅限改动不涉及图片时可用）。
- 如需重新生成缩略图：需要 `public/perfumes/` 原图，跑 `npm run thumbnails`。

## 构建产物

`dist/client/` 即为可部署站点（对应线上版本，自带 `_headers`、`_redirects`）。
把 `dist/client/` 整个文件夹拖进 Netlify 即可发布。
