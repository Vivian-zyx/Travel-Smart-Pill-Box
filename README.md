# 旅药记｜智能药盒旅行用药原型

一个基于 Vite、React 与 TypeScript 的手机端旅行用药原型。界面固定采用移动应用的单列布局、顶部 App 栏、底部标签导航和底部抽屉表单；即使在电脑浏览器中打开，也会以居中的手机宽度呈现。业务数据保存在当前浏览器的 `localStorage` 中；只有药单 AI 识别会调用服务端代理。

## 一键部署到 Vercel（线上 AI 可用）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVivian-zyx%2FTravel-Smart-Pill-Box&env=DEEPSEEK_API_KEY&envDescription=DeepSeek%20API%20Key%EF%BC%8C%E4%BB%85%E4%BF%9D%E5%AD%98%E5%9C%A8%20Vercel%20%E6%9C%8D%E5%8A%A1%E7%AB%AF&envLink=https%3A%2F%2Fplatform.deepseek.com%2Fapi_keys)

1. 点击上方按钮并登录 Vercel。
2. 保持 Framework Preset 为 **Vite**，填写 `DEEPSEEK_API_KEY`。
3. 点击 **Deploy**。`DEEPSEEK_MODEL` 不填时默认使用 `deepseek-flash`。
4. 部署完成后访问 `https://你的域名/api/ai/status`。看到 `"configured":true` 即表示服务端已读取密钥。
5. 回到首页，创建旅行后进入“上传医院药单”，按钮应显示“使用 DeepSeek 识别全部药品”。

Vercel 会将 `api/ai/status.ts` 和 `api/prescription-ocr.ts` 部署为 Functions。API Key 不会进入浏览器构建产物。药单大图会先在浏览器本机压缩，以避免超过 Vercel Functions 的请求体限制。

> `configured: true` 只能证明密钥已配置。首次上线后仍应使用一张不含敏感信息的测试图片完成实际识别，以确认密钥有效、账户余额充足且 DeepSeek 服务可访问。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开终端输出的本地地址（通常为 `http://localhost:5173`）。

复制 `.env.example` 为 `.env.local`，填入自己的 DeepSeek API Key。密钥只由本地 Vite 服务端中间件读取，禁止使用 `VITE_` 前缀，以免进入浏览器构建产物。

生产构建与类型检查：

```bash
pnpm typecheck
pnpm build
```

## 可体验流程

- 创建旅行并校验日期
- 修改已有旅行的名称、目的地和起止日期，并保留其药品与记录
- 手动添加计划内用药，并按重叠旅行天数计算携带数量
- 上传药单图片，通过 DeepSeek 图像理解逐条生成全部药品的可编辑、待确认草稿，并一次加入药单
- 按场景浏览带厂家与来源链接的固定药品目录，或手动添加备用药
- 在双层药盒俯视图中选择唯一格位；已占用格显示药片图标与药名且不可重复选择，并可按药名查找位置
- 在旅行模式按日期查看计划、确认已服用、演示页面内提醒
- 查看已确认 / 未确认记录及备用药携带回顾

## Mock 与安全边界

- 配置 DeepSeek 后，只有用户主动点击识别按钮才会把药单图片发送至 DeepSeek；识别到的药品会全部作为待核对草稿展示。
- 核对后会一次加入所有有药名的条目；缺少时间、每次数量或单位的条目仍会保存，但不会生成服用提醒。
- DeepSeek 不可用时可以主动切换到固定的离线 Mock 草稿，不会静默伪装为真实识别。
- 备用药候选来自本地固定目录，条目包含真实药名、生产企业与来源链接，不由大模型临时生成；具体信息仍以实际包装说明书为准。
- 提醒仅为页面内模拟，不使用系统通知或推送服务。
- 药盒装入状态由用户手动确认，没有连接硬件或传感器。
- 所有药品信息只用于演示交互，不提供诊断、处方、个性化推荐、剂量或疗程调整建议。

## 服务端结构与安全

- 本地开发由 `server/deepseekProxy.ts` 提供 `/api` 中间件。
- Vercel 生产环境由 `api/` 下的 Serverless Functions 提供相同接口。
- 两种环境共用 `server/deepseekCore.ts`，避免本地与线上识别逻辑不一致。
- 接口限制为同源浏览器调用，并校验图片格式、请求大小和模型输出；但公开网站仍可能遭到脚本滥用。正式开放前请在 Vercel 与 DeepSeek 控制台设置预算告警、用量上限，并按需要增加登录、持久化限流或 WAF。
- 药单可能包含健康和身份信息。正式收集真实用户数据前，需要补充明确同意、隐私政策、数据保留规则和访问控制。
- 真实药品目录仍需经审核的数据来源、说明书字段、OTC / 处方标识、更新与审核责任。

## 常见问题

- 页面显示 Mock：先打开 `/api/ai/status`。若为 `configured: false`，在 Vercel 的 Production、Preview 环境中添加 `DEEPSEEK_API_KEY` 后重新部署。
- 返回 401 或 403：检查 DeepSeek Key 是否有效，以及对应账户权限。
- 返回 402 或余额相关错误：为 DeepSeek 账户充值或调整用量设置。
- 返回 413：裁剪药单无关区域后再上传。浏览器会自动压缩大图，但极端尺寸或浏览器不支持解码时仍可能失败。
- 请求超时：稍后重试，并在 Vercel Functions 日志和 DeepSeek 控制台检查请求状态。

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 或 `master` 分支后，工作流会自动安装依赖、运行 `pnpm build`，并发布生成的 `dist` 目录。

首次部署时，在 GitHub 仓库中打开 **Settings → Pages**，将 **Source** 设置为 **GitHub Actions**。不要直接把 `dist`、`node_modules` 或 `.env.local` 上传到仓库，也不要拆散 `src`、`server` 和 `.github` 文件夹。

GitHub Pages 只提供静态托管，不能运行本项目的 DeepSeek 代理，因此 Pages 版本会自动使用 Mock 识别。这是预期行为；需要线上 AI 时请使用上方的 Vercel 部署。
