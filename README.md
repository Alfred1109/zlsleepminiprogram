# 疗愈系统小程序

> 基于微信小程序的疗愈应用  
> 版本：v2.0  
> 重构日期：2025-08-23  

## 项目概述

疗愈系统小程序提供个性化音乐生成、心理评测、疗愈计划等功能，帮助用户通过音乐进行情绪调节和心理疗愈。

## 核心功能

- 🎵 **智能音乐生成** - 基于用户情绪和偏好生成个性化音乐
- 📊 **心理评测系统** - 专业量表评估用户心理状态
- 🔗 **设备连接管理** - 安全的蓝牙设备连接和控制
- 💳 **订阅权限系统** - 智能的功能权限管理和试用引导
- 🎮 **全局播放器** - 定时播放、波形显示、历史记录
- 📚 **音乐库管理** - 个人音乐收藏和历史记录
- 👤 **用户系统** - 注册登录、游客模式、订阅管理
- 📈 **数据分析** - 使用习惯和效果追踪

## 技术架构

### 前端架构
```
小程序框架：微信小程序原生开发
UI组件：自定义组件 + WeUI
状态管理：页面级状态 + 全局事件总线
网络请求：统一 API 封装
认证系统：AuthService 统一管理
```

### 目录结构
```
ZL-疗愈系统小程序/
├── pages/           # 页面文件
│   ├── index/       # 首页（统一播放管理、推荐加载）
│   ├── music/       # 音乐相关页面
│   │   ├── generate/    # AI音乐生成
│   │   ├── library/     # 音乐库
│   │   └── player/      # 音乐播放器
│   ├── assessment/  # 评测相关页面
│   │   ├── scales/      # 量表选择
│   │   ├── questions/   # 答题页面
│   │   └── result/      # 结果展示
│   ├── device/      # 设备管理页面
│   │   ├── bind/        # 设备绑定
│   │   └── control/     # 设备控制
│   ├── subscription/ # 订阅管理页面
│   ├── profile/     # 个人中心
│   └── login/       # 登录页面
├── components/      # 自定义组件
│   ├── global-player/   # 全局播放器（定时、波形、控制）
│   ├── brainwave-realtime/ # 实时脑波显示
│   ├── realtime-waveform/  # 实时波形组件
│   └── static-waveform/    # 静态波形组件
├── services/        # 业务服务层
│   └── AuthService.js # 统一认证服务
├── utils/           # 工具函数
│   ├── api.js           # API 请求封装
│   ├── healingApi.js    # 业务API封装
│   ├── tokenManager.js  # Token 管理（底层）
│   ├── bluetoothManager.js # 蓝牙设备管理
│   ├── deviceWhitelist.js  # 设备白名单管理
│   ├── subscription.js     # 订阅权限管理
│   ├── unifiedMusicManager.js # 统一音乐管理
│   ├── qiniuManagerUnified.js # 七牛云管理
│   └── eventEmitter.js     # 事件总线
├── docs/           # 项目文档
├── tests/          # 测试文件
└── milestones/     # 里程碑文档
```

## 认证系统（v2.0 重构）

### 新架构特点
- **统一认证入口** - `AuthService` 提供所有认证相关操作
- **自动 token 管理** - 自动刷新、游客登录回退
- **全局事件通知** - 登录状态变化实时广播
- **统一存储键名** - 标准化本地存储管理

### 使用示例
```javascript
const AuthService = require('../services/AuthService')

// 检查登录状态
const userInfo = AuthService.getCurrentUser()
const isLoggedIn = !!userInfo

// 监听认证状态变化
const bus = getApp().globalData.bus
bus.on('auth:changed', (payload) => {
  // 处理登录状态变化
})
```

详细使用说明请参考：[AuthService 使用指南](./docs/auth-service-guide.md)

## 新功能模块详解

### 🔗 设备连接管理
**核心文件**: `utils/bluetoothManager.js`、`utils/deviceWhitelist.js`

- **智能设备过滤** - 只显示后台授权的设备
- **安全连接验证** - MAC地址白名单验证
- **自动设备绑定** - 连接成功后自动绑定到用户
- **连接状态管理** - 实时监控设备连接状态

```javascript
// 使用示例
const bluetoothManager = require('../utils/bluetoothManager')

// 扫描并连接设备
bluetoothManager.scanDevices()
bluetoothManager.connectDevice(deviceId)
```

### 💳 订阅权限系统
**核心文件**: `utils/subscription.js`

- **智能权限拦截** - 访问受限功能时自动检查
- **试用期管理** - 一键激活7天免费试用
- **权限缓存** - 避免频繁请求后端验证
- **用户引导** - 友好的订阅/试用选择界面

```javascript
// 使用示例
const { requireSubscription } = require('../utils/subscription')

// 检查功能权限
await requireSubscription('music_generate')
```

### 🎮 全局播放器组件
**核心文件**: `components/global-player/`

- **定时播放控制** - 设置播放时长，自动停止
- **循环播放支持** - 音乐结束前定时器到期时循环播放
- **实时波形显示** - 音乐可视化效果
- **播放历史记录** - 自动记录用户播放行为

```javascript
// 使用示例
const globalPlayer = this.selectComponent('#global-player')

// 开始定时播放
globalPlayer.startTimer(30) // 30分钟后停止

// 播放音乐
globalPlayer.playTrack({
  title: '疗愈音乐',
  url: 'https://example.com/music.mp3'
})
```

### 📊 数据管理系统
**核心文件**: `utils/healingApi.js`

- **统一API封装** - 所有业务接口的统一管理
- **数据缓存策略** - 智能缓存减少网络请求
- **离线数据支持** - 关键数据本地存储
- **实时数据同步** - 播放记录实时上报

```javascript
// 使用示例
const { MusicAPI, SubscriptionAPI, DeviceAPI } = require('../utils/healingApi')

// 获取个性化推荐
const recommendations = await MusicAPI.getPersonalizedRecommendations(userId)

// 检查订阅状态
const subscriptionInfo = await SubscriptionAPI.getInfo()

// 验证设备权限
const deviceStatus = await DeviceAPI.verifyDevice(macAddress)
```

## 快速开始

### 1. 环境准备
- 微信开发者工具
- Node.js (用于部分工具脚本)
- 小程序开发账号

### 2. 项目配置
```javascript
// app.js 中配置后端地址
const BASE_URL = 'https://your-backend-domain.com/api'
```

### 3. 运行项目
1. 用微信开发者工具打开项目目录
2. 配置 AppID
3. 编译运行

### 4. 开发调试
```javascript
// 使用认证调试工具
const { runAuthProbe } = require('./utils/devAuthProbe')
runAuthProbe() // 检查认证流程
```

## API 接口

### 认证相关
- `POST /auth/login` - 用户登录
- `POST /auth/guest-login` - 游客登录
- `POST /auth/refresh-token` - 刷新令牌
- `POST /auth/logout` - 用户登出

### 音乐相关
- `GET /music/user_music/{user_id}` - 获取用户音乐
- `POST /music/generate` - 生成音乐（需订阅权限）
- `GET /music/library` - 音乐库列表
- `POST /music/create_long_sequence` - 创建长序列音乐（VIP功能）
- `GET /music/personalized_recommendations/{user_id}` - 个性化推荐

### 评测相关
- `GET /assessment/scales` - 获取量表列表
- `POST /assessment/start` - 开始评测
- `POST /assessment/submit` - 提交评测
- `GET /assessment/history` - 评测历史记录

### 订阅系统
- `GET /subscription/info` - 获取订阅信息
- `POST /subscription/check-permission` - 检查功能权限
- `POST /subscription/start-trial` - 开始免费试用
- `GET /subscription/plans` - 获取订阅套餐

### 设备管理
- `GET /device-whitelist/` - 获取设备白名单
- `POST /device-whitelist/verify` - 验证设备权限
- `POST /device-whitelist/bind` - 绑定设备到用户
- `POST /device-whitelist/unbind` - 解绑设备
- `GET /device-whitelist/my-devices` - 获取我的设备列表

### 播放记录
- `POST /play-records/` - 上报播放记录
- `GET /play-records/recent` - 获取最近播放
- `GET /play-records/statistics` - 播放统计

## 开发规范

### 1. 代码规范
- 使用 ES6+ 语法
- 遵循小程序官方开发规范
- 统一错误处理和加载状态

### 2. 认证规范
- 统一使用 `AuthService` 进行认证操作
- 不直接调用 `tokenManager`
- API 请求统一通过 `utils/api.js`

### 3. 存储规范
- 统一使用新键名：`access_token`、`refresh_token`、`user_info`
- 避免直接使用 `wx.getStorageSync`/`wx.setStorageSync`

### 4. 事件规范
- 使用全局事件总线进行页面间通信
- 认证状态变化监听 `auth:changed` 事件

## 测试

### 认证系统测试
```javascript
// 运行认证测试
const { runAllTests } = require('./tests/auth.test.js')
runAllTests()
```

### 手动测试清单
- [ ] 登录/登出流程
- [ ] 游客登录回退
- [ ] Token 自动刷新
- [ ] 401 错误处理
- [ ] 页面状态同步

## 部署

### 小程序发布
1. 代码审核
2. 版本管理
3. 发布配置
4. 监控配置

### 版本管理
- 版本号规范：`主版本.次版本.修订版本`
- 当前版本：v2.0（认证系统重构版本）

## 故障排除

### 常见问题

#### 1. 登录状态异常
**现象**：页面显示未登录，但实际已登录
**解决**：检查是否使用了旧的用户信息获取方式，改为 `AuthService.getCurrentUser()`

#### 2. API 请求 401 错误
**现象**：接口总是返回 401 未授权
**解决**：确保使用 `utils/api.js` 统一请求，避免直接使用 `wx.request`

#### 3. 游客登录失败
**现象**：无法自动获取游客权限
**解决**：检查后端 `/auth/guest-login` 接口，使用调试工具验证

#### 4. 页面状态不同步
**现象**：登录后其他页面未刷新
**解决**：确保页面正确监听 `auth:changed` 事件

### 调试工具
```javascript
// 认证自检
const { runAuthProbe } = require('./utils/devAuthProbe')

// 测试套件
const { runAllTests } = require('./tests/auth.test.js')
```

## 贡献指南

### 开发流程
1. 创建功能分支
2. 开发新功能
3. 编写测试
4. 代码审查
5. 合并主分支

### 里程碑管理
重大重构和功能开发使用里程碑管理，详见：[认证重构里程碑](./milestones/auth_refactor_milestone.md)

## 更新日志

### v2.1 (2025-08-25) - 设备管理与订阅系统
- ✅ **设备白名单系统** - MAC地址安全验证和设备绑定
- ✅ **智能蓝牙管理** - 设备过滤、连接验证、自动绑定
- ✅ **订阅权限系统** - 功能权限管理、试用期支持
- ✅ **全局播放器升级** - 定时播放、循环控制、波形显示
- ✅ **统一API管理** - 业务接口封装和缓存优化
- ✅ **数据上报系统** - 播放记录追踪和用户行为分析

### v2.0 (2025-08-23) - 认证系统重构
- ✅ 统一认证服务 `AuthService`
- ✅ 自动 token 刷新和游客登录
- ✅ 全局事件总线
- ✅ 统一存储键名
- ✅ 完善错误处理
- ✅ 增加调试工具和测试

### v1.x - 历史版本
- 基础功能实现
- 原始认证流程
- 页面和组件开发

## 🔗 相关文档

- [项目架构文档](../../structure.md) - 完整的系统架构说明
- [后端系统文档](../ZL-疗愈系统后台/README.md) - 后台管理系统文档
- [设备白名单指南](../ZL-疗愈系统后台/docs/device_whitelist_guide.md) - 设备管理详细说明
- [AuthService 使用指南](./docs/auth-service-guide.md) - 认证系统使用说明

## 许可证

本项目为内部开发项目，版权所有。

## 联系方式

- 项目负责人：[团队联系人]
- 技术支持：[技术团队邮箱]
- 问题反馈：[Issue 地址]
