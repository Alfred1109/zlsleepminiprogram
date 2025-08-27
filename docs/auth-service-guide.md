# AuthService 认证服务使用指南

> 重构日期：2025-08-23  
> 版本：v2.1 (精简版)  

## 概述

`AuthService` 是疗愈小程序的**唯一**认证管理服务。精简版去除了冗余的代理层，直接整合了所有认证功能，包括 token 管理、微信登录、游客登录等。

## 核心功能

### 1. 完整认证功能
- **getAccessToken()** - 获取当前访问令牌
- **ensureValidToken()** - 确保获得有效令牌（自动刷新或游客登录）
- **addAuthHeader(headers)** - 为请求注入 Authorization 头
- **getCurrentUser()** - 获取当前登录用户信息
- **wechatLogin()** - 微信登录（整合原 unifiedLoginManager 功能）
- **guestLogin()** - 游客登录
- **logout()** - 登出并清理所有认证信息

### 2. 自动认证流程
- **token 自动刷新** - 在 token 即将过期时自动刷新
- **游客登录回退** - 当无有效 token 时自动执行游客登录
- **401 统一处理** - 在 API 层统一处理认证失败

### 3. 全局事件通知
- **auth:changed** - 登录状态变化时广播（登录成功、登出、token 刷新）
- 支持页面监听并自动更新 UI

### 4. 精简架构
- **无代理层** - 直接管理所有认证逻辑，不再依赖 tokenManager
- **统一入口** - 所有认证操作通过 AuthService 完成
- **轻量化** - 删除了重复的测试工具和调试代码

## 基本使用

### 引入服务
```javascript
const AuthService = require('../services/AuthService')
```

### 页面登录检查
```javascript
// 旧方式（已废弃）
// const tokenManager = require('../../utils/tokenManager')
// const isLoggedIn = tokenManager.isLoggedIn()

// 新方式
const userInfo = AuthService.getCurrentUser()
const isLoggedIn = !!userInfo

if (isLoggedIn) {
  console.log('当前用户:', userInfo)
  this.setData({ userInfo, isLoggedIn: true })
} else {
  console.log('用户未登录')
  wx.navigateTo({ url: '/pages/login/login' })
}
```

### API 请求认证
```javascript
// API 层自动注入（在 utils/api.js 中）
// 无需页面手动处理 Authorization 头
const result = await MusicAPI.getUserMusic(userId)
```

### 手动登出
```javascript
// 登出并跳转
AuthService.logout()
wx.reLaunch({ url: '/pages/index/index' })
```

### 监听登录状态变化
```javascript
// 在页面 onLoad 中监听
onLoad() {
  // 监听认证状态变化
  const bus = getApp().globalData.bus
  bus.on('auth:changed', this.handleAuthChange.bind(this))
},

handleAuthChange(payload) {
  console.log('认证状态变化:', payload)
  if (payload.status === 'logged_in') {
    this.setData({ 
      userInfo: payload.user,
      isLoggedIn: true 
    })
  } else if (payload.status === 'logged_out') {
    this.setData({ 
      userInfo: null,
      isLoggedIn: false 
    })
  }
}
```

## 存储键名规范

统一使用以下键名存储认证信息：

| 键名 | 说明 | 示例值 |
|------|------|--------|
| `access_token` | 访问令牌 | `eyJhbGciOiJIUzI1NiIs...` |
| `refresh_token` | 刷新令牌 | `eyJhbGciOiJIUzI1NiIs...` |
| `user_info` | 用户信息 | `{id: "123", username: "user", nickname: "昵称"}` |
| `token_expires` | 访问令牌过期时间戳 | `1692864000000` |
| `refresh_expires` | 刷新令牌过期时间戳 | `1693468800000` |

**⚠️ 注意：不再使用 `token`、`userInfo` 等旧键名**

## 事件系统

### 事件类型
```javascript
// 登录成功
{ status: 'logged_in', user: {...} }

// 登出
{ status: 'logged_out' }

// Token 刷新成功
{ status: 'token_refreshed', user: {...} }
```

### 全局事件总线
```javascript
// 在 app.js 中已初始化
const bus = getApp().globalData.bus

// 监听事件
bus.on('auth:changed', (payload) => {
  console.log('认证状态变化:', payload)
})

// 手动触发（一般不需要）
bus.emit('auth:changed', { status: 'logged_in', user: {...} })
```

## 错误处理

### 自动处理场景
- **Token 过期** - 自动尝试刷新，失败则游客登录
- **无 Token** - 自动执行游客登录
- **401 错误** - API 层统一处理，清理无效 token

### 手动处理场景
```javascript
try {
  const user = AuthService.getCurrentUser()
  if (!user) {
    throw new Error('用户未登录')
  }
  
  // 业务逻辑
  await doSomething()
} catch (error) {
  if (error.message.includes('登录')) {
    wx.showToast({ title: '请先登录', icon: 'none' })
    wx.navigateTo({ url: '/pages/login/login' })
  } else {
    wx.showToast({ title: error.message, icon: 'none' })
  }
}
```

## 开发调试

### 使用调试工具
```javascript
// 在页面中引入调试工具
const { runAuthProbe } = require('../../utils/devAuthProbe')

// 在 onLoad 中运行自检
onLoad() {
  if (process.env.NODE_ENV === 'development') {
    runAuthProbe()
  }
}
```

### 常见调试信息
- 认证状态检查
- Token 有效性验证
- 游客登录流程测试
- 事件广播验证

## 迁移指南

### 从旧版本迁移

#### 1. 替换引用
```javascript
// 旧代码
const tokenManager = require('../../utils/tokenManager')

// 新代码
const AuthService = require('../../services/AuthService')
```

#### 2. 替换方法调用
```javascript
// 旧代码
const isLoggedIn = tokenManager.isLoggedIn()
const userInfo = tokenManager.getCurrentUser()
tokenManager.clearTokens()

// 新代码
const userInfo = AuthService.getCurrentUser()
const isLoggedIn = !!userInfo
AuthService.logout()
```

#### 3. 移除手动 token 检查
```javascript
// 旧代码（移除）
const token = tokenManager.getToken()
if (!token) {
  wx.showToast({ title: '请先登录', icon: 'none' })
  return
}

// 新代码（自动处理）
// API 调用会自动确保 token 有效性
const result = await SomeAPI.getData()
```

## 最佳实践

### 1. 页面初始化
```javascript
Page({
  onLoad() {
    this.checkLoginStatus()
    this.setupAuthListener()
  },

  checkLoginStatus() {
    const userInfo = AuthService.getCurrentUser()
    this.setData({
      userInfo,
      isLoggedIn: !!userInfo
    })
  },

  setupAuthListener() {
    const bus = getApp().globalData.bus
    bus.on('auth:changed', this.handleAuthChange.bind(this))
  },

  handleAuthChange(payload) {
    if (payload.status === 'logged_in') {
      this.setData({ userInfo: payload.user, isLoggedIn: true })
    } else {
      this.setData({ userInfo: null, isLoggedIn: false })
    }
  }
})
```

### 2. API 调用
```javascript
// 直接调用，认证处理由 AuthService 自动完成
async loadData() {
  try {
    wx.showLoading({ title: '加载中...' })
    const data = await SomeAPI.getData()
    this.setData({ data })
  } catch (error) {
    wx.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

### 3. 条件渲染
```xml
<!-- 根据登录状态显示不同内容 -->
<view wx:if="{{isLoggedIn}}">
  <text>欢迎，{{userInfo.nickname}}</text>
</view>
<view wx:else>
  <button bindtap="goLogin">登录</button>
</view>
```

## 常见问题

### Q: 页面显示未登录，但实际已登录？
A: 检查页面是否使用了旧的 `wx.getStorageSync('userInfo')` 方式获取用户信息。应改为 `AuthService.getCurrentUser()`。

### Q: API 请求总是返回 401？
A: 确保 API 调用时使用统一的 `utils/api.js` 而不是直接 `wx.request`。`AuthService` 会自动注入认证头。

### Q: 游客登录失败怎么办？
A: 检查后端 `/auth/guest-login` 接口是否正常。可使用 `devAuthProbe.js` 工具调试。

### Q: 事件监听没有生效？
A: 确保在 `app.js` 中正确初始化了事件总线，并在页面中正确监听 `auth:changed` 事件。

---

## 版本历史

- **v2.0** (2025-08-23) - 重构为 AuthService，统一认证流程
- **v1.x** - 原 tokenManager 直接调用方式（已废弃）
