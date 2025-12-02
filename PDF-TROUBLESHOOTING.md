# PDF上传功能故障排查

## 当前状态

❌ **测试失败** - 返回500错误

## 问题分析

### 错误信息
```
素材分析失败: 分析失败: 状态码: 500
```

### 可能原因

1. **ES模块兼容性问题**
   - `pdf-to-img`是一个纯ES模块（type: "module"）
   - Next.js的API路由默认使用CommonJS
   - 动态导入可能在服务器端失败

2. **依赖问题**
   - `pdf-to-img`依赖`pdfjs-dist`
   - 可能需要额外的配置

3. **Node.js版本要求**
   - `pdf-to-img` v5.0.0要求Node.js >= 20
   - 需要检查当前Node版本

## 解决方案

### 方案1：检查Node.js版本

```bash
node --version
```

如果版本 < 20，需要升级Node.js。

### 方案2：使用替代库

由于`pdf-to-img`的ES模块兼容性问题，建议使用其他PDF处理库：

#### 推荐：使用`pdf-lib` + `pdfjs-dist`

```bash
npm uninstall pdf-to-img
npm install pdf-lib pdfjs-dist canvas
```

#### 或者：使用`pdf2pic`

```bash
npm uninstall pdf-to-img
npm install pdf2pic
```

### 方案3：暂时禁用PDF功能

如果急需测试其他功能，可以暂时禁用PDF上传：

1. 在前端移除PDF文件类型支持
2. 在后端添加PDF类型检查并返回友好错误

## 当前代码修改

### 已完成
- ✅ 添加PDF文件检测
- ✅ 使用动态导入`pdf-to-img`
- ✅ 添加webpack配置
- ✅ 添加详细错误日志

### 待测试
- ⏳ 验证Node.js版本
- ⏳ 查看服务器详细错误日志
- ⏳ 测试替代方案

## 测试步骤

### 1. 检查Node版本
```bash
node --version
```

### 2. 查看服务器日志
上传PDF文件后，查看终端输出的详细错误信息，特别是：
- `[ERROR] PDF processing failed:`
- `[ERROR] PDF error stack:`
- `[ERROR] PDF error details:`

### 3. 测试普通图片
先测试上传普通图片（PNG/JPG）确认基本功能正常。

## 临时解决方案

如果PDF功能暂时无法工作，可以：

1. **继续使用PSD功能** - 已经正常工作
2. **使用图片格式** - PNG/JPG/WEBP都支持
3. **手动转换PDF** - 使用外部工具将PDF转为图片后上传

## 下一步行动

1. **立即执行**：
   ```bash
   node --version
   ```
   检查Node版本是否 >= 20

2. **如果版本不够**：
   - 升级Node.js到v20或更高
   - 或使用替代库

3. **如果版本足够**：
   - 上传PDF文件
   - 查看服务器终端的详细错误日志
   - 根据错误信息调整代码

## 联系信息

如需帮助，请提供：
1. Node.js版本（`node --version`）
2. 服务器终端的完整错误日志
3. 上传的PDF文件大小和类型
