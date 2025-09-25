# 音乐生成页面场景映射逻辑修复总结

## 🎯 问题诊断

根据参考文档分析，发现音乐生成页面存在以下关键问题：

### 主要问题：单选模式缺少 scene_id 参数传递

**问题描述：**
- 多选模式正确传递了 `sceneContext` 参数
- 单选模式**没有传递** `sceneContext` 参数
- 导致单选模式生成的音乐缺少 `scene_id` 字段，无法正确映射到场景

**影响范围：**
1. ❌ 音乐生成页面（单选模式）
2. ❌ 长序列生成页面（单选模式）
3. ❌ API层面（单选时不传递场景上下文）

## ✅ 修复内容

### 1. 修复音乐生成页面 (`pages/music/generate/generate.js`)

**修复前：**
```javascript
if (selectionMode === 'single') {
  console.log('🎵 单选模式生成音乐，评测ID:', selectedAssessment.id)
  result = await MusicAPI.generateMusic(selectedAssessment.id) // ❌ 缺少场景上下文
}
```

**修复后：**
```javascript
if (selectionMode === 'single') {
  console.log('🎵 单选模式生成音乐，评测ID:', selectedAssessment.id)
  
  // 🔧 修复：单选模式也需要传递场景上下文，确保生成的音乐能正确关联场景ID
  const generateOptions = {}
  if (this.data.sceneContext) {
    generateOptions.sceneContext = this.data.sceneContext
    console.log('🎯 传递场景上下文:', this.data.sceneContext)
  }
  
  result = await MusicAPI.generateMusic(selectedAssessment.id, generateOptions)
}
```

### 2. 修复长序列生成页面 (`pages/longSequence/create/create.js`)

**修复前：**
```javascript
if (selectionMode === 'single') {
  console.log('🎵 单选模式生成长序列，评测ID:', selectedAssessment.scale_id)
  result = await LongSequenceAPI.createLongSequence(
    selectedAssessment.scale_id,
    durationMinutes
  ) // ❌ 缺少场景上下文
}
```

**修复后：**
```javascript
if (selectionMode === 'single') {
  console.log('🎵 单选模式生成长序列，评测ID:', selectedAssessment.scale_id)
  
  // 🔧 修复：单选模式也需要传递场景上下文，确保生成的长序列能正确关联场景ID
  const createOptions = {}
  if (this.data.sceneContext) {
    createOptions.sceneContext = this.data.sceneContext
    console.log('🎯 传递场景上下文:', this.data.sceneContext)
  }
  
  result = await LongSequenceAPI.createLongSequence(
    selectedAssessment.scale_id,
    durationMinutes,
    createOptions
  )
}
```

### 3. 修复API层面 (`utils/healingApi.js`)

**问题：** 单选模式时，API 没有检查和传递场景上下文

**修复：**

#### 音乐生成API
```javascript
// 🔧 修复：无论单选还是多选模式，都需要检查和传递场景上下文
if (options.sceneContext) {
  requestData.scene_context = options.sceneContext
  console.log('🎯 音乐生成传递场景上下文:', options.sceneContext)
}
```

#### 长序列生成API
```javascript
// 🔧 修复：无论单选还是多选模式，都需要检查和传递场景上下文
if (options.sceneContext) {
  requestData.scene_context = options.sceneContext
  console.log('🎯 长序列生成传递场景上下文:', options.sceneContext)
}
```

## 📊 场景上下文数据结构

根据 `utils/sceneContextManager.js`，场景上下文包含以下关键信息：

```javascript
{
  sceneId: 1,              // ✅ 场景ID - 这是关键字段
  sceneName: "助眠场景",    // ✅ 场景名称
  scaleType: "PSQI",       // ✅ 关联量表类型
  sceneTheme: "助眠场景",   // ✅ 场景主题
  source: "/pages/scene/detail/detail", // ✅ 来源页面
  timestamp: 1727265000000, // ✅ 时间戳
  active: true             // ✅ 活跃状态
}
```

**关键：** `sceneId` 字段会被传递给后端，后端应该提取这个字段保存到音频表的 `scene_id` 字段中。

## 🔄 数据流验证

### 修复后的预期流程：

1. **用户从场景页面进入** → 设置场景上下文（包含 sceneId）
2. **选择评测并生成音乐** → 前端传递完整的 sceneContext
3. **API调用** → 将 scene_context 发送给后端
4. **后端处理** → 提取 sceneContext.sceneId 保存到音频表
5. **场景筛选** → 根据 scene_id 正确过滤音频

### 验证要点：

- ✅ 单选模式传递场景上下文
- ✅ 多选模式传递场景上下文（原本正常）
- ✅ API统一处理场景上下文传递
- ⏳ 后端正确提取并保存 scene_id（需要后端配合验证）

## 🎯 修复对照参考文档

参考文档要求：

> ### ✅ 需要的映射关系
> 1. **量表ID ↔ 场景ID** - 已实现
> 2. **音频ID ↔ 场景ID** - 新增实现 ← **本次修复的核心**

> ### 音频数据结构
> ```sql
> - scene_id: 关联场景ID ⭐ 新增字段
> ```

> ### 音乐生成
> - `POST /api/music/generate` - 生成音乐（需传入scene_id）

**修复结果：** ✅ 现在无论单选还是多选模式，都会正确传递 `sceneContext`，后端可以提取 `sceneId` 保存到 `scene_id` 字段。

## 🔍 后续验证建议

1. **测试场景：** 从场景页面进入，使用单选模式生成音乐
2. **检查日志：** 确认场景上下文正确传递
3. **验证数据库：** 确认生成的音频记录包含正确的 `scene_id`
4. **测试筛选：** 验证场景筛选功能正常工作

---

*修复完成时间: 2025-09-25*
*修复范围: 前端页面 + API层*
*状态: ✅ 修复完成，等待测试验证*
