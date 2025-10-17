# 🔧 Vercel 环境变量配置指南

## 问题诊断

你遇到的问题：**线上版本（Vercel）的剧本分析功能失败，但画布功能正常**

## 🔍 可能的原因

### 1. 环境变量配置问题（最可能）

#### 检查清单：
- [ ] 环境变量名称是否正确：`OPENROUTER_API_KEY`
- [ ] 环境变量是否应用到了 **Production** 环境（不只是 Preview）
- [ ] 环境变量值是否有多余的空格或引号
- [ ] 环境变量值格式是否正确（以 `sk-or-v1-` 开头）

### 2. Vercel 函数超时
- 剧本分析可能需要更长时间处理
- 免费版 Vercel 有 10 秒超时限制
- 已添加 `maxDuration: 60` 配置（需要 Pro 计划）

### 3. 运行时配置缺失
- 已添加 `runtime: 'nodejs'` 配置
- 已添加 `dynamic: 'force-dynamic'` 确保动态渲染

## ✅ 解决方案

### 步骤 1: 检查 Vercel 环境变量配置

1. **登录 Vercel Dashboard**
   - 访问：https://vercel.com/dashboard
   - 选择你的项目

2. **进入环境变量设置**
   - 点击 `Settings` 标签
   - 点击左侧菜单的 `Environment Variables`

3. **检查配置**

   确保有以下配置：

   | 变量名 | 值 | 环境 |
   |--------|-----|------|
   | `OPENROUTER_API_KEY` | `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` | ✅ Production<br>✅ Preview<br>✅ Development |

   **重要**：
   - ✅ 必须勾选 **Production** 环境
   - ✅ 变量名必须完全一致（区分大小写）
   - ✅ 值前后不能有空格或引号

4. **如果已经配置过，需要重新部署**
   - 环境变量修改后，需要重新部署才能生效
   - 点击 `Deployments` 标签
   - 找到最新的部署，点击右侧的 `...` 菜单
   - 选择 `Redeploy`

### 步骤 2: 使用诊断 API 检查

部署完成后，访问以下 URL 检查环境变量是否正确加载：

```
https://你的域名.vercel.app/api/analyze-script
```

应该返回类似这样的 JSON：
```json
{
  "status": "ready",
  "timestamp": "2025-10-15T09:30:00.000Z",
  "message": "Analyze script API is ready",
  "env": {
    "hasApiKey": true,
    "apiKeyPrefix": "sk-or-v1-bb5"
  }
}
```

**检查点**：
- ✅ `hasApiKey` 应该是 `true`
- ✅ `apiKeyPrefix` 应该显示你的密钥前缀（不是 `not-set`）

### 步骤 3: 检查 Vercel 计划限制

如果你使用的是 **Hobby（免费）计划**：
- ⚠️ 函数执行时间限制：10 秒
- ⚠️ 剧本分析可能超时

**解决方案**：
1. 升级到 Pro 计划（$20/月）
2. 或者优化剧本分析逻辑，减少处理时间

### 步骤 4: 查看 Vercel 部署日志

1. 进入 Vercel Dashboard
2. 点击 `Deployments` 标签
3. 点击最新的部署
4. 点击 `Functions` 标签
5. 找到 `api/analyze-script` 函数
6. 查看日志中是否有错误信息

常见错误：
- `[ERROR] OpenRouter API Key not configured` → 环境变量未配置
- `Function execution timed out` → 超时（需要升级计划）
- `Invalid API key format` → 密钥格式错误

## 📋 完整配置检查清单

### Vercel Dashboard 配置

- [ ] **Environment Variables** 页面
  - [ ] 变量名：`OPENROUTER_API_KEY`（完全一致）
  - [ ] 变量值：`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`
  - [ ] 环境：✅ Production ✅ Preview ✅ Development
  - [ ] 保存后重新部署

- [ ] **项目设置**
  - [ ] Framework Preset: Next.js
  - [ ] Node.js Version: 18.x 或更高
  - [ ] Build Command: `npm run build`
  - [ ] Output Directory: `.next`

### 本地代码更新

我已经为你更新了以下文件：

1. ✅ `app/api/analyze-script/route.ts`
   - 添加了 Vercel 运行时配置
   - 添加了诊断 GET 端点
   - 添加了环境变量检查

2. ✅ `app/api/image-generation/route.ts`
   - 添加了相同的运行时配置

3. ✅ `vercel.json`
   - 配置了函数超时时间
   - 配置了区域（香港）

### 部署步骤

```bash
# 1. 提交代码
git add .
git commit -m "fix: 添加 Vercel 运行时配置和环境变量诊断"
git push

# 2. Vercel 会自动部署
# 或者手动触发部署：
vercel --prod
```

## 🧪 测试步骤

部署完成后，按以下顺序测试：

### 1. 测试诊断 API
```bash
curl https://你的域名.vercel.app/api/analyze-script
```

期望输出：
```json
{
  "status": "ready",
  "env": {
    "hasApiKey": true,
    "apiKeyPrefix": "sk-or-v1-bb5"
  }
}
```

### 2. 测试剧本分析功能
- 访问你的网站
- 输入一段简短的剧本（先测试短文本）
- 点击"分析剧本"
- 观察是否成功

### 3. 查看浏览器控制台
- 按 F12 打开开发者工具
- 查看 Console 和 Network 标签
- 如果失败，记录错误信息

## 🔍 常见问题排查

### Q1: 环境变量配置了但还是不生效？
**A**: 必须重新部署！环境变量修改后不会自动应用到已部署的版本。

### Q2: 诊断 API 显示 `hasApiKey: false`？
**A**:
1. 检查环境变量名称是否完全一致（区分大小写）
2. 确认勾选了 Production 环境
3. 重新部署

### Q3: 诊断 API 显示 `hasApiKey: true` 但功能还是失败？
**A**:
1. 检查密钥值是否正确（没有多余空格）
2. 检查 OpenRouter 账户余额
3. 查看 Vercel 函数日志

### Q4: 提示超时错误？
**A**:
1. 检查你的 Vercel 计划（免费版 10 秒限制）
2. 尝试分析更短的剧本
3. 考虑升级到 Pro 计划

### Q5: 画布功能正常但剧本分析失败？
**A**:
1. 画布功能可能处理时间更短，没有超时
2. 或者画布功能使用了不同的 API
3. 检查两个 API 的日志对比

## 📞 需要帮助？

如果按照以上步骤还是无法解决，请提供：

1. Vercel 部署日志截图
2. 浏览器控制台错误信息
3. 诊断 API 的返回结果
4. 你的 Vercel 计划类型（Hobby/Pro）

## 🎯 下一步

1. **立即操作**：
   - 检查 Vercel 环境变量配置
   - 确保勾选了 Production 环境
   - 重新部署

2. **提交代码**：
   ```bash
   git add .
   git commit -m "fix: 添加 Vercel 配置和诊断功能"
   git push
   ```

3. **测试验证**：
   - 访问诊断 API
   - 测试剧本分析功能
   - 查看日志

---

**重要提示**：我已经在代码中添加了诊断功能，部署后你可以直接访问 `/api/analyze-script` 查看环境变量是否正确加载。这是最快的诊断方法！
