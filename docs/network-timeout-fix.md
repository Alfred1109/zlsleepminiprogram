# 网络超时问题修复

## 问题分析

**现象**：小程序访问 `http://192.168.124.3:5000/api/devices/whitelist` 一直超时（5秒超时）

**验证**：服务器端测试正常
```bash
# 服务器状态 ✅
curl -s http://192.168.124.3:5000/api/health
# 返回: {"message":"AI疗愈系统运行正常","status":"healthy","success":true}

curl -s http://192.168.124.3:5000/api/devices/whitelist  
# 返回: {"data":[],"success":true,"total":0}
```

## 根本原因

1. **超时设置过短** - 5秒超时在真机调试环境下不够
2. **网络并发冲突** - IP检测和正常API请求同时进行，造成网络拥塞
3. **网络环境差异** - 小程序网络环境可能比服务器本地测试复杂

## 修复方案

### 1. 增加超时时间

**设备白名单API**: 5秒 → 15秒
```javascript
// utils/healingApi.js
timeout: 15000, // 增加到15秒超时
```

**设备绑定API**: 5秒 → 15秒
```javascript
timeout: 15000, // 15秒超时
```

**网络诊断**: 5秒 → 10秒
```javascript
// utils/networkDiagnostic.js
timeout: 10000,
```

**蓝牙管理器**: 5秒 → 20秒
```javascript
// utils/bluetoothManager.js
setTimeout(() => reject(new Error('白名单加载超时 (20秒)')), 20000)
```

### 2. 优化IP检测逻辑

**减少网络冲突**:
```javascript
// utils/ipDetector.js
// 延迟网络段扫描，避免与正常请求冲突
console.log('⏳ 延迟5秒后进行网络段扫描，避免冲突...');
await new Promise(resolve => setTimeout(resolve, 5000));
```

**增加IP测试超时**:
```javascript
async testIP(ip, timeout = 8000) { // 3秒 → 8秒
```

### 3. 减少并发压力

**降低并发扫描**:
```javascript
const batchSize = 2; // 3 → 2，减少并发数量
await new Promise(resolve => setTimeout(resolve, 1000)); // 增加批次间延迟
```

## 修复效果

### 修复前
```
networkManager.js:132 网络请求失败: {errno: 5, errMsg: "request:fail timeout"}
bluetoothManager.js:217 设备白名单初始化失败: 白名单加载超时 (5秒)
```

### 修复后（预期）
```
api.js:110 📖 公开API，无需认证头: /devices/whitelist
deviceWhitelist.js:31 从服务器获取设备白名单...
deviceWhitelist.js:42 设备白名单更新成功，共 0 个设备
```

## 网络优化策略

1. **分层超时**: 不同类型请求使用不同超时时间
2. **避免并发冲突**: IP检测延迟执行，避免与业务请求冲突  
3. **降级处理**: 网络失败时仍能使用缓存和硬编码备选
4. **批次控制**: 降低并发扫描强度，减少网络压力

## 适配建议

- **开发环境**: 15-20秒超时
- **生产环境**: 10-15秒超时  
- **弱网环境**: 可考虑更长超时时间

---

**修复日期**: 2025年8月24日  
**影响范围**: 网络请求、设备管理、IP检测  
**测试状态**: 待验证
