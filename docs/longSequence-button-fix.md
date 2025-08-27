# 长序列创建按钮修复

## 问题描述
音乐库页面的"创建长序列"按钮点击无响应，用户无法跳转到长序列创建页面。

## 根本原因
长序列相关页面没有在 `app.json` 中注册，导致 `wx.navigateTo` 跳转失败。

## 解决方案
在 `app.json` 的 `pages` 数组中添加缺失的页面：

### 新增页面注册
```json
"pages/longSequence/create/create",  // 长序列创建页面
"pages/longSequence/player/player",  // 长序列播放页面
"pages/history/history",             // 历史记录页面
"pages/play/play"                    // 播放页面
```

### 按钮事件流程
1. 用户点击音乐库页面的"创建长序列"按钮
2. 触发 `onGoToCreateSequence()` 方法
3. 执行 `wx.navigateTo({ url: '/pages/longSequence/create/create' })`
4. 跳转到长序列创建页面

## 修复文件
- `app.json` - 添加页面注册

## 测试验证
✅ 音乐库页面点击"创建长序列"按钮可正常跳转  
✅ 长序列创建页面正常显示  
✅ 其他新注册的页面导航正常  

## 相关页面
- 音乐库页面：`pages/music/library/library`
- 长序列创建：`pages/longSequence/create/create`
- 长序列播放：`pages/longSequence/player/player`

**修复日期**：2025-08-23  
**修复类型**：页面注册缺失
