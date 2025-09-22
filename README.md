# AI 动态漫画人物设计工具

一个基于 AI 的动态漫画人物设计工具，支持剧本分析、角色提示词生成、场景提示词生成和素材管理。

## 🚀 功能特性

- **剧本解析**：支持 TXT 和 DOCX 格式的剧本文件解析
- **AI 分析**：使用多种 AI 模型进行剧本内容分析
- **角色生成**：自动生成详细的角色描述和绘画提示词
- **场景生成**：生成场景描述和环境提示词
- **素材管理**：上传和管理角色素材，智能匹配推荐
- **画布工具**：拖拽式画布，支持图片组合和编辑

## 🛠️ 技术栈

- **前端**：Next.js 14, React 18, TypeScript, Tailwind CSS
- **后端**：Next.js API Routes, Supabase
- **数据库**：PostgreSQL (Supabase)
- **AI 服务**：OpenRouter API
- **文件处理**：Mammoth.js (DOCX), 自定义 TXT 解析
- **UI 组件**：Radix UI, Lucide React
- **部署**：Docker, Vercel, GitHub Actions

## 📋 环境要求

- Node.js 18.0 或更高版本
- npm 或 pnpm
- Supabase 账户和项目
- OpenRouter API 密钥

## 🔧 本地开发

### 1. 克隆项目

```bash
git clone <repository-url>
cd ai-manga-character-design-tool
```

### 2. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 3. 环境配置

复制环境变量模板：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入必要的配置：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. 数据库设置

在 Supabase 中执行以下 SQL 脚本：

```bash
# 创建表结构
scripts/01-create-tables.sql

# 插入示例数据（可选）
scripts/02-insert-sample-data.sql

# 设置 RLS 策略
scripts/03-setup-rls-policies.sql
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🚀 生产环境部署

### 方法一：使用 Vercel（推荐）

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 方法二：使用 Docker

```bash
# 构建镜像
npm run docker:build

# 运行容器
npm run docker:run
```

### 方法三：自定义服务器

```bash
# 清理开发文件
node scripts/cleanup-for-production.js --confirm

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 📊 监控和健康检查

应用提供了健康检查端点：

```bash
# 检查应用状态
curl http://localhost:3000/api/health

# 使用 npm 脚本
npm run health-check
```

## 🔒 安全配置

应用包含以下安全措施：

- **安全头部**：CSP, HSTS, X-Frame-Options 等
- **CORS 配置**：限制跨域请求
- **速率限制**：防止 API 滥用
- **输入验证**：清理和验证用户输入
- **环境变量保护**：敏感信息不暴露给客户端

## 📈 性能优化

- **图片优化**：Next.js 自动图片优化
- **代码分割**：自动代码分割和懒加载
- **缓存策略**：合理的缓存头部设置
- **压缩**：Gzip 压缩静态资源
- **监控**：内置性能监控和错误追踪

## 🧪 测试

```bash
# 运行类型检查
npm run type-check

# 运行 ESLint
npm run lint

# 修复 ESLint 错误
npm run lint:fix

# 运行测试（如果有）
npm test
```

## 📁 项目结构

```
├── app/                    # Next.js 13+ App Router
│   ├── api/               # API 路由
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页面
├── components/            # React 组件
├── lib/                   # 工具库和配置
├── hooks/                 # 自定义 React Hooks
├── public/                # 静态资源
├── scripts/               # 数据库脚本和工具
├── .github/               # GitHub Actions 工作流
└── docs/                  # 文档
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本是否 >= 18
   - 清理缓存：`npm run clean`
   - 重新安装依赖：`npm run clean:all && npm install`

2. **数据库连接失败**
   - 检查 Supabase URL 和密钥是否正确
   - 确认数据库表已创建
   - 检查网络连接

3. **AI API 调用失败**
   - 检查 OpenRouter API 密钥是否有效
   - 确认 API 配额是否充足
   - 检查网络连接

### 获取帮助

- 查看 [Issues](https://github.com/your-repo/issues) 页面
- 阅读 [文档](./docs/)
- 联系维护者

## 📞 联系方式

- 项目维护者：[Your Name]
- 邮箱：[your.email@example.com]
- 项目主页：[https://github.com/your-repo]
