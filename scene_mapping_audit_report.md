# 场景映射逻辑全面审计报告

## 🎯 审计背景

基于用户提供的映射逻辑参考文档，对整个系统进行了全面的场景映射逻辑审计，确保**音频ID ↔ 场景ID**的映射关系正确实现。

## 🔍 发现的问题

### 1. ❌ 音乐生成页面 - 单选模式缺少scene_id传递

**文件：** `pages/music/generate/generate.js`

**问题：**
- 多选模式正确传递了 `sceneContext`
- 单选模式**没有传递** `sceneContext`
- 导致单选生成的音乐缺少 `scene_id` 字段

**修复：** ✅ 已修复
```javascript
// 修复前
result = await MusicAPI.generateMusic(selectedAssessment.id)

// 修复后  
const generateOptions = {}
if (this.data.sceneContext) {
  generateOptions.sceneContext = this.data.sceneContext
}
result = await MusicAPI.generateMusic(selectedAssessment.id, generateOptions)
```

### 2. ❌ 长序列生成页面 - 单选模式缺少scene_id传递

**文件：** `pages/longSequence/create/create.js`

**问题：** 与音乐生成页面相同的问题

**修复：** ✅ 已修复
```javascript
// 修复前
result = await LongSequenceAPI.createLongSequence(
  selectedAssessment.scale_id,
  durationMinutes
)

// 修复后
const createOptions = {}
if (this.data.sceneContext) {
  createOptions.sceneContext = this.data.sceneContext
}
result = await LongSequenceAPI.createLongSequence(
  selectedAssessment.scale_id,
  durationMinutes,
  createOptions
)
```

### 3. ❌ API层面 - 单选模式不传递场景上下文

**文件：** `utils/healingApi.js`

**问题：**
- API只在多选模式检查场景上下文
- 单选模式时不会传递 `scene_context` 给后端

**修复：** ✅ 已修复
```javascript
// 音乐生成API - 修复后
const requestData = { assessment_id: assessmentId }

// 🔧 修复：无论单选还是多选模式，都需要检查和传递场景上下文
if (options.sceneContext) {
  requestData.scene_context = options.sceneContext
  console.log('🎯 音乐生成传递场景上下文:', options.sceneContext)
}
```

### 4. ❌ 评测结果页面 - 跳转时丢失场景上下文

**文件：** `pages/assessment/result/result.js`

**问题：**
- 从场景页面 → 评测 → 评测结果 → 生成音乐
- 评测结果页面跳转时只传递 `assessmentId`
- **场景上下文被中断**，无法传递给后续的音乐生成

**修复：** ✅ 已修复
- 添加了 `sceneContextManager` 导入
- 添加了场景上下文检查逻辑
- 修改跳转时保持场景上下文（通过 `sceneContextManager` 全局状态）

## ✅ 确认正常的页面

### 1. ✅ 音乐库页面 (`pages/music/library/library.js`)
- **场景过滤逻辑正确**
- 使用 `sceneMappingService.isMusicMatchingScene()` 动态过滤
- 支持场景模式和非场景模式切换

### 2. ✅ 场景详情页面 (`pages/scene/detail/detail.js`) 
- **场景上下文设置正确**
- 正确调用 `sceneContextManager.setSceneContext()`
- 脑波历史过滤逻辑正确

### 3. ✅ 首页导航 (`pages/index/index.js`)
- **场景跳转逻辑正确**
- 点击场景卡片时正确传递场景参数
- 底部菜单导航不会干扰场景上下文

### 4. ✅ 评测量表页面 (`pages/assessment/scales/scales.js`)
- **场景过滤逻辑正确** 
- 使用 `sceneMappingService.isScaleMatchingScene()` 过滤量表

## 📊 修复效果对比

### 修复前的数据流：
```
场景页面 → 设置场景上下文 → 评测 → 评测结果 → ❌ 丢失场景上下文 → 音乐生成(无scene_id)
```

### 修复后的数据流：
```
场景页面 → 设置场景上下文 → 评测 → 评测结果 → ✅ 保持场景上下文 → 音乐生成(带scene_id)
```

## 🎯 符合参考文档要求

根据参考文档的要求：

> ### ✅ 需要的映射关系
> 1. **量表ID ↔ 场景ID** - 已实现 ✅
> 2. **音频ID ↔ 场景ID** - 新增实现 ✅ **本次修复的核心**

> ### 音频数据结构
> ```sql
> - scene_id: 关联场景ID ⭐ 新增字段
> ```

**修复结果：** ✅ 现在所有音乐生成（单选/多选，60秒/长序列）都会正确传递 `sceneContext`，后端可以提取 `sceneId` 保存到 `scene_id` 字段。

## 🔧 技术实现细节

### 场景上下文数据结构：
```javascript
{
  sceneId: 1,              // ⭐ 关键字段 - 后端提取此字段保存为scene_id
  sceneName: "助眠场景",
  scaleType: "PSQI", 
  sceneTheme: "助眠场景",
  source: "/pages/scene/detail/detail",
  timestamp: 1727265000000,
  active: true
}
```

### API传递格式：
```javascript
// 发送给后端的数据
{
  assessment_id: 123,
  scene_context: {          // ⭐ 整个场景上下文对象
    sceneId: 1,             // ⭐ 后端应提取此字段作为scene_id
    sceneName: "助眠场景",
    // ... 其他字段
  }
}
```

## 🎉 总结

通过本次全面审计和修复：

1. ✅ **修复了4个关键的场景映射问题**
2. ✅ **确保音频生成时正确关联场景ID**
3. ✅ **验证了场景过滤逻辑的正确性**
4. ✅ **完善了场景上下文传递链路**

现在整个系统的场景映射逻辑已经完全符合参考文档的要求，实现了完整的**音频ID ↔ 场景ID**映射关系。

---

*审计完成时间: 2025-09-25*
*修复文件数量: 4个*
*状态: ✅ 全部修复完成*
