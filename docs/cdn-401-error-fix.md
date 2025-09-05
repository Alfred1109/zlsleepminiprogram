# CDN 401错误修复指南

## 🔍 问题现象

用户播放音频时出现以下错误：
```
GET https://cdn.medsleep.cn/healing/1755508222_air-vent-1-27167.mp3 401(env: Linux,mp,1.06.2504010; lib: 3.9.1)
DOMException: Unable to decode audio data
```

## 📋 问题根本原因

### 1. **URL缺少认证参数**
```
❌ 错误的URL: https://cdn.medsleep.cn/healing/1755508222_air-vent-1-27167.mp3
✅ 正确的URL: https://cdn.medsleep.cn/healing/1755508222_air-vent-1-27167.mp3?token=xxx&e=xxx
```

### 2. **401错误未被正确处理**
- 之前只处理 `NSURLErrorDomain -1013` 错误
- 401 HTTP错误和 "Unable to decode audio data" 错误未被识别为CDN认证失败

## ✅ 修复方案

### 1. **增强CDN错误检测**
新增多种CDN认证失败错误的检测模式：
- `NSURLErrorDomain错误-1013` (iOS认证失败)
- `Unable to decode audio data` (通用解码失败，通常是401返回HTML)
- `401` (HTTP 401错误) 
- `Unauthorized` (未授权错误)
- `Access denied` (访问被拒绝)
- `Token expired` (Token过期)
- `Signature not match` (签名不匹配)

### 2. **详细URL诊断分析**
自动分析问题URL：
```javascript
🔍 URL结构分析:
  - 完整URL: https://cdn.medsleep.cn/healing/xxx.mp3
  - 是否为CDN链接: 是
  - 是否有token参数: 否 ❌
  - 是否有过期参数: 否 ❌

❌ CDN链接缺少token参数，这是问题根源
💡 原因分析: 后端生成URL时未添加认证参数
💡 解决方案: 需要通过API刷新获取带token的正确URL
```

### 3. **自动修复流程**
```
1. 检测到CDN认证失败
2. 显示"刷新播放链接..."
3. 调用后端API获取新的认证URL
4. 自动重新播放音频
5. 用户无感知完成修复
```

## 🔧 代码修改

### MusicPlayer.js 增强
- ✅ 新增 `detectCdnAuthError()` 检测各种CDN错误
- ✅ 新增 `analyzeCdnUrl()` 详细分析URL结构
- ✅ 新增 `onCdnAuthFailure()` 触发自动修复事件

### Global-Player.js 增强  
- ✅ 扩展 `isCdnAuthError()` 支持401等多种错误
- ✅ 监听来自MusicPlayer的CDN认证失败事件
- ✅ 自动调用 `handleCdnAuthError()` 修复流程

## 🎯 修复效果

### 用户体验改善
**修复前:**
```
❌ 音频无法播放
❌ 提示"播放失败"
❌ 用户需要手动重新选择音频
```

**修复后:**
```
✅ 自动检测CDN认证失败
✅ 显示"刷新播放链接..."
✅ 自动获取新的认证URL
✅ 无感知继续播放
✅ 详细的问题诊断日志
```

### 调试信息增强
现在会显示详细的诊断信息：
```
🔐 CDN认证失败详细分析:
  - 错误码: 10002
  - 错误消息: Unable to decode audio data
  - 当前音频源: https://cdn.medsleep.cn/healing/xxx.mp3

🔍 URL结构分析:
  - 是否为CDN链接: 是
  - 是否有token参数: 否 ❌
  - 是否有过期参数: 否 ❌

💡 解决方案: 需要通过API刷新获取带token的正确URL
🔄 CDN认证失败，触发自动修复流程
```

## 🧪 测试验证

### 测试步骤
1. 播放任意音频文件
2. 等待CDN token过期或遇到401错误
3. 观察是否自动刷新URL并继续播放
4. 检查Console中的详细诊断信息

### 预期结果
- ✅ 自动检测CDN认证失败
- ✅ 显示"刷新播放链接..."加载提示
- ✅ 调用 `/music/refresh_url/{musicId}` API
- ✅ 获取新的带token的URL
- ✅ 自动重新播放音频
- ✅ 用户体验无中断

## 🔮 兼容性保证

### 向后兼容
- ✅ 保留原有的 NSURLErrorDomain -1013 错误处理
- ✅ 兼容现有的自动刷新机制
- ✅ 如果API不存在，显示友好错误提示

### 错误降级
- 如果自动刷新失败，提供重试选项
- 如果重试失败，引导用户重新选择音频
- 保留原有的错误处理流程作为最后兜底

## 📞 后续监控

建议监控以下指标：
- [ ] CDN 401错误的发生频率
- [ ] 自动修复的成功率
- [ ] 用户播放体验的改善程度
- [ ] 后端URL生成的token完整性

---
*修复完成时间: ${new Date().toLocaleString()}*  
*问题状态: 已修复，支持自动恢复*
