# 🚀 内网穿透快速部署指南

## 🎉 **当前部署状态**

### **访问信息：**
- **本地地址**: http://localhost:3002
- **公网地址**: https://6726142c0fc9a20a6689e3adc845fe8a.serveo.net
- **隧道工具**: serveo.net (SSH隧道)
- **状态**: ✅ 运行中

### **🆕 新增功能 (2025-01-15)：**
- ✅ **多模型选择**: 支持3个长文本AI模型
  - Sonoma Dusk Alpha (2M tokens, 免费)
  - Sonoma Sky Alpha (2M tokens, 免费)
  - Google Gemini 1.5 Pro (2M tokens, 付费)
- ✅ **直接文本输入**: 无需上传文件，支持直接粘贴长文本
- ✅ **无长度限制**: 支持超长剧本文本（最多2M tokens）
- ✅ **智能模型推荐**: 默认选择最佳免费模型

---

## 快速开始

### Windows 用户
```bash
# 双击运行
start-tunnel.bat
```

### Mac/Linux 用户
```bash
# 给脚本执行权限
chmod +x start-tunnel.sh

# 运行脚本
./start-tunnel.sh
```

## 手动部署步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 启动应用
```bash
npm run dev
```
应用将在 http://localhost:3000 启动

### 3. 安装内网穿透工具

#### 选项1: ngrok (推荐)
```bash
# 下载并安装 ngrok
# Windows: https://ngrok.com/download
# Mac: brew install ngrok
# Linux: 下载二进制文件

# 创建隧道
ngrok http 3000
```

#### 选项2: localtunnel
```bash
# 安装
npm install -g localtunnel

# 创建隧道
lt --port 3000 --subdomain your-app-name
```

#### 选项3: frp (需要自己的服务器)
```bash
# 下载 frp 客户端
# 配置 frpc.ini 文件
# 运行 ./frpc -c frpc.ini
```

## 功能验证清单

部署完成后，请测试以下功能：

- [ ] 访问主页面
- [ ] 剧本上传和分析
- [ ] 角色提示词生成
- [ ] 场景提示词生成
- [ ] 素材上传和分析
- [ ] 画布功能 (拖拽、多选)
- [ ] AI图片生成
- [ ] 素材库浏览

## 常见问题

### Q: 端口被占用怎么办？
```bash
# 使用其他端口
npm run dev -- -p 3001
ngrok http 3001
```

### Q: 环境变量不生效？
- 确保 `.env.local` 文件在项目根目录
- 重启开发服务器
- 检查文件编码是否为 UTF-8

### Q: API 调用失败？
- 检查 OpenRouter API 密钥是否正确
- 确认网络连接正常
- 查看浏览器控制台错误信息

### Q: 图片上传失败？
- 检查 Supabase 配置
- 确认存储桶权限设置
- 验证文件大小限制

## 安全注意事项

⚠️ **重要提醒**：
- 仅用于内部测试，不要在生产环境使用
- 不要分享隧道URL给不信任的人
- 定期更换隧道URL
- 监控API使用量，避免超额费用

## 技术支持

如遇问题，请检查：
1. 控制台错误信息
2. 网络连接状态
3. API密钥有效性
4. 数据库连接状态

---

🎉 **部署完成后，您就可以通过公网URL访问您的动态漫人设工具了！**
