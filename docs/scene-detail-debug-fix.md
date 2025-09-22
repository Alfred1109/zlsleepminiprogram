# 场景详情页面调试问题修复

## 问题概述

从用户提供的日志中发现了几个问题：

```javascript
🎯 场景2映射到音乐类型: (2) [{…}, {…}]
🔍 音乐「undefined」在场景2中匹配: false
🎯 场景「专注场景」(ID:2)脑波历史过滤: {原始数量: 3, 场景相关: 0}
TypeError: wx.$emitter.off is not a function
```

## 问题分析与修复

### 1. ✅ wx.$emitter.off 错误修复

**问题：**
```javascript
TypeError: wx.$emitter.off is not a function
```

**原因：**
在某些情况下，wx.$emitter 的状态可能不正确，导致 off 方法不存在。

**修复前：**
```javascript
onUnload() {
  // 清理主题监听器
  if (wx.$emitter && this.themeChangeHandler) {
    wx.$emitter.off('themeChanged', this.themeChangeHandler);
  }
}
```

**修复后：**
```javascript
onUnload() {
  // 清理主题监听器 - 增加安全检查
  if (wx.$emitter && typeof wx.$emitter.off === 'function' && this.themeChangeHandler) {
    try {
      wx.$emitter.off('themeChanged', this.themeChangeHandler);
      console.log('🧹 场景详情页面主题监听器已清理');
    } catch (error) {
      console.error('清理主题监听器失败:', error);
    }
  }
}
```

### 2. ✅ 音乐名称undefined问题修复

**问题：**
```javascript
🔍 音乐「undefined」在场景2中匹配: false
```

**原因：**
场景详情页面向场景映射服务传递的是 `brainwave.rawData`，而不是包含 `name` 字段的完整对象。

**修复前：**
```javascript
const brainwaveFilterPromises = allBrainwaves.map(brainwave => 
  sceneMappingService.isMusicMatchingScene(
    brainwave.rawData, // ❌ 传递rawData，缺少name字段
    this.data.sceneId,
    this.data.sceneName
  )
)
```

**修复后：**
```javascript
const brainwaveFilterPromises = allBrainwaves.map(brainwave => 
  sceneMappingService.isMusicMatchingScene(
    brainwave, // ✅ 传递完整对象，包含name字段
    this.data.sceneId,
    this.data.sceneName
  )
)
```

### 3. ✅ 场景匹配逻辑修复

**问题：**
```javascript
🎯 场景「专注场景」(ID:2)脑波历史过滤: {原始数量: 3, 场景相关: 0}
```

**原因：**
场景映射服务需要访问音乐对象的特定字段来进行匹配：
```javascript
const musicCategories = [
  music.assessment_scale_name,
  music.scale_type,
  music.scale_name,
  music.category,
  music.type,
  music.tags
].filter(Boolean)
```

但是场景详情页面的 `brainwave` 对象结构缺少这些字段：
```javascript
{
  id: item.id,
  name: this.generate60sAudioName(item),
  type: '60s_generated', // 这个type不是场景匹配需要的
  rawData: item // 真正的数据在这里
}
```

**修复方案：**
将场景映射服务需要的字段从 `rawData` 提升到顶级：

**修复前：**
```javascript
const userMusic = musicResult.value.data.map(item => ({
  id: item.id,
  name: this.generate60sAudioName(item),
  // ... 其他字段
  type: '60s_generated',
  rawData: item
}))
```

**修复后：**
```javascript
const userMusic = musicResult.value.data.map(item => ({
  id: item.id,
  name: this.generate60sAudioName(item),
  // ... 其他字段
  type: '60s_generated',
  // 🔧 修复：将场景映射服务需要的字段提升到顶级
  assessment_scale_name: item.assessment_info?.scale_name || item.scale_name,
  scale_type: item.assessment_info?.scale_type || item.scale_type,
  scale_name: item.assessment_info?.scale_name || item.scale_name,
  category: item.category,
  tags: item.tags,
  rawData: item
}))
```

## 修复逻辑

### 字段映射策略：
1. **assessment_scale_name**: 从 `item.assessment_info?.scale_name` 或 `item.scale_name` 获取
2. **scale_type**: 从 `item.assessment_info?.scale_type` 或 `item.scale_type` 获取
3. **scale_name**: 与 assessment_scale_name 相同
4. **category**: 直接从 `item.category` 获取
5. **tags**: 直接从 `item.tags` 获取

### 适用范围：
- ✅ 60秒音频处理
- ✅ 长序列音频处理

## 预期效果

### 修复前的问题：
- ❌ wx.$emitter.off 运行时错误
- ❌ 场景映射服务看到音乐名称为 undefined
- ❌ 场景匹配全部失败（3个脑波过滤后变成0个）

### 修复后的改善：
- ✅ 安全的监听器清理，无运行时错误
- ✅ 场景映射服务能正确显示音乐名称
- ✅ 场景匹配逻辑能访问到所需的字段
- ✅ 脑波过滤结果应该更准确

## 验证方案

### 测试步骤：
1. **进入专注场景页面**
2. **查看控制台日志**：
   - 应该看到音乐名称正确显示：`🔍 音乐「XXX」在场景2中匹配: true/false`
   - 应该看到过滤结果有变化：`场景相关: X`（不再是0）
   - 不应该有 wx.$emitter.off 错误
3. **离开页面**：应该能正常清理监听器

### 预期日志：
```javascript
🎯 场景2映射到音乐类型: (2) [{…}, {…}]
🔍 音乐「汉密尔顿抑郁量表-17项 · 正常」在场景2中匹配: true
🔍 音乐「长序列脑波」在场景2中匹配: false
🎯 场景「专注场景」(ID:2)脑波历史过滤: {原始数量: 3, 场景相关: 1}
🧠 场景专注场景脑波历史加载完成: 1
🧹 场景详情页面主题监听器已清理
```

## 相关文件

**修复文件：**
- `pages/scene/detail/detail.js` - 主要修复文件

**依赖服务：**
- `utils/sceneMappingService.js` - 场景映射服务

**修复点：**
1. `onUnload()` - wx.$emitter.off 安全检查
2. `loadBrainwaveHistory()` - 音乐对象数据结构完善
3. `filterBrainwavesByScene()` - 传递正确的对象类型

## 技术细节

### 错误处理增强：
```javascript
// 类型检查
if (wx.$emitter && typeof wx.$emitter.off === 'function' && this.themeChangeHandler)

// try-catch包装
try {
  wx.$emitter.off('themeChanged', this.themeChangeHandler);
} catch (error) {
  console.error('清理主题监听器失败:', error);
}
```

### 数据结构标准化：
确保传递给场景映射服务的对象包含所有必要的字段，使其能够正确进行场景匹配判断。

## 结论

这次修复解决了场景详情页面的三个关键问题：
1. **运行时错误**：wx.$emitter.off 调用失败
2. **数据传递问题**：音乐名称显示为 undefined
3. **场景匹配失效**：缺少必要字段导致匹配逻辑无法正常工作

修复后，场景详情页面的脑波过滤功能应该能够正常工作，为用户提供准确的场景化脑波推荐。

**修复时间：**2025-09-22  
**影响功能：**场景详情页面脑波过滤、主题监听器清理  
**修复状态：**✅ 已完成
