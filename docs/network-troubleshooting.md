# 网络连接问题排查指南

## 🔧 **快速解决方案**

### 1. **禁用自动功能（推荐）**
如果你遇到大量网络连接错误，可以禁用相关自动功能：

在 `utils/config.js` 文件中，设置：
```javascript
ENABLE_IP_DETECTION: false        // 禁用自动IP检测
ENABLE_DEVICE_WHITELIST: false    // 禁用设备白名单预加载
ENABLE_NETWORK_DIAGNOSTIC: false  // 禁用自动网络诊断
```

### 2. **手动配置API地址**
确保 `utils/config.js` 中的API地址正确：
```javascript
API_BASE_URL: 'http://127.0.0.1:5000/api',  // 本地开发
STATIC_BASE_URL: 'http://127.0.0.1:5000',   // 静态资源
```

## 🌐 **网络配置说明**

### 开发环境配置
- **本地开发**：使用 `127.0.0.1:5000`
- **真机调试**：可启用 `ENABLE_IP_DETECTION: true` 自动检测电脑IP
- **生产环境**：使用正式的域名地址

### 自动IP检测
当 `ENABLE_IP_DETECTION: true` 时，系统会：
1. 检测当前网络中可用的开发机IP
2. 自动更新API配置
3. 适用于真机调试场景

## 🔍 **常见问题**

### Q: 出现 `ERR_CONNECTION_REFUSED` 错误
**原因**：后端服务未启动或IP地址不正确
**解决**：
1. 确保后端服务正在运行
2. 检查防火墙设置
3. 禁用IP自动检测，手动配置正确的IP地址

### Q: 大量重复的网络错误日志
**原因**：IP检测或网络重试产生的冗余日志
**解决**：
1. 禁用IP自动检测
2. 已优化：重试时的错误日志已简化

### Q: 设备白名单获取失败/超时
**原因**：
- 设备白名单用于管理小程序可连接的外部设备（蓝牙等），不是验证手机设备
- 开发环境通常不需要连接外部设备，但系统尝试加载白名单
- 后端设备管理API不可用或网络超时

**解决**：
1. 开发环境：设置 `ENABLE_DEVICE_WHITELIST: false` 跳过加载
2. 已添加失败冷却机制，避免重复请求
3. 生产环境：确保后端设备管理API可用

### Q: 自动网络诊断产生错误
**原因**：应用启动时自动运行网络诊断检查后端连接
**解决**：
1. 开发环境已默认禁用网络诊断
2. 可通过 `ENABLE_NETWORK_DIAGNOSTIC: false` 完全禁用

## 🚀 **性能优化**

### 减少网络请求
- 禁用不必要的IP检测
- 禁用自动网络诊断（开发环境）
- 禁用设备白名单预加载（开发环境）
- 使用缓存机制避免重复请求
- 失败冷却期避免无效重试

### 错误日志优化
- 简化重试时的错误信息
- 避免重复记录相同错误
- 保留关键错误信息用于调试

## 📝 **配置建议**

### 开发阶段
```javascript
ENABLE_IP_DETECTION: false,        // 稳定性优先
ENABLE_DEVICE_WHITELIST: false,    // 减少网络请求
ENABLE_NETWORK_DIAGNOSTIC: false,  // 避免启动检查
API_BASE_URL: 'http://127.0.0.1:5000/api',
DEBUG: true,
RETRY_COUNT: 2  // 减少重试次数
```

### 真机测试
```javascript
ENABLE_IP_DETECTION: true,          // 自动检测IP
ENABLE_DEVICE_WHITELIST: false,     // 测试时可禁用
ENABLE_NETWORK_DIAGNOSTIC: false,   // 避免测试干扰
TIMEOUT: 10000,                     // 适当降低超时时间
RETRY_COUNT: 2                      // 减少重试次数
```

### 生产环境
```javascript
ENABLE_IP_DETECTION: false,         // 使用固定域名
ENABLE_DEVICE_WHITELIST: true,      // 启用设备管理
ENABLE_NETWORK_DIAGNOSTIC: true,    // 启用连接监控
API_BASE_URL: 'https://api.yourdomain.com/api',
DEBUG: false,
RETRY_COUNT: 3
```
