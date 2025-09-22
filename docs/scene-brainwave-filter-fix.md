# 场景页面AI生成脑波列表过滤修复

## 问题描述

场景详情页面对于AI生成的脑波列表，过滤没有生效。用户进入特定场景页面时，显示的是所有脑波，而不是与当前场景相关的脑波。

## 问题分析

通过代码分析发现，在场景详情页面（`pages/scene/detail/detail.js`）中：

### ✅ 评测历史过滤正确实现：
```javascript
// 在 loadAssessmentHistory() 方法中
const sceneFilterPromises = filteredAssessments.map(item => 
  sceneMappingService.isScaleMatchingScene(
    item, 
    this.data.sceneId, 
    this.data.sceneName
  )
)

const matchResults = await Promise.all(sceneFilterPromises)
filteredAssessments = filteredAssessments.filter((item, index) => matchResults[index])
```

### ❌ 脑波历史过滤缺失：
```javascript
// 在 loadBrainwaveHistory() 方法中
// 直接显示所有脑波，没有场景过滤！
this.setData({
  brainwaveHistory: allBrainwaves.slice(0, 10)
})
```

**根本原因：**
- 评测历史使用了 `sceneMappingService.isScaleMatchingScene()` 进行场景过滤
- 脑波历史没有使用 `sceneMappingService.isMusicMatchingScene()` 进行场景过滤
- 导致场景页面显示用户的所有脑波，而不是与当前场景相关的脑波

## 解决方案

### 修复前：
```javascript
// 按时间排序
allBrainwaves.sort((a, b) => {
  const dateA = new Date(a.rawData.updated_at || a.rawData.created_at || 0)
  const dateB = new Date(b.rawData.updated_at || b.rawData.created_at || 0)
  return dateB - dateA
})

this.setData({
  brainwaveHistory: allBrainwaves.slice(0, 10) // ❌ 显示所有脑波
})
```

### 修复后：
```javascript
// 按时间排序
allBrainwaves.sort((a, b) => {
  const dateA = new Date(a.rawData.updated_at || a.rawData.created_at || 0)
  const dateB = new Date(b.rawData.updated_at || b.rawData.created_at || 0)
  return dateB - dateA
})

// 🔧 修复：添加场景过滤逻辑
let filteredBrainwaves = allBrainwaves
if (this.data.sceneId && allBrainwaves.length > 0) {
  try {
    // 使用场景映射服务过滤脑波记录（与脑波库页面保持一致）
    const brainwaveFilterPromises = allBrainwaves.map(brainwave => 
      sceneMappingService.isMusicMatchingScene(
        brainwave.rawData,
        this.data.sceneId,
        this.data.sceneName
      )
    )
    
    const matchResults = await Promise.all(brainwaveFilterPromises)
    filteredBrainwaves = allBrainwaves.filter((brainwave, index) => matchResults[index])
    
    console.log(`🎯 场景「${this.data.sceneName}」(ID:${this.data.sceneId})脑波历史过滤:`, {
      原始数量: allBrainwaves.length,
      场景相关: filteredBrainwaves.length,
      过滤结果: filteredBrainwaves.map(item => item.name),
      映射服务调试: sceneMappingService.getDebugInfo()
    })
    
  } catch (error) {
    console.error('❌ 场景脑波历史过滤失败，显示所有脑波:', error)
    // 过滤失败时保持原始数据
  }
}

this.setData({
  brainwaveHistory: filteredBrainwaves.slice(0, 10) // ✅ 只显示场景相关脑波
})
```

## 修复逻辑

### 关键步骤：

1. **获取所有脑波数据**：从API获取60秒音频和长序列音频
2. **时间排序**：按照更新时间倒序排列
3. **场景过滤**（新增）：
   - 检查是否有场景ID和脑波数据
   - 使用 `sceneMappingService.isMusicMatchingScene()` 对每个脑波进行场景匹配
   - 只保留与当前场景相关的脑波
4. **数据设置**：将过滤后的脑波设置到页面数据中
5. **错误处理**：过滤失败时显示所有脑波，确保功能可用性

### 统一性保证：

现在场景详情页面的脑波过滤逻辑与以下页面保持一致：
- ✅ 脑波库页面：`filterBrainwavesByScene()`
- ✅ 音乐生成页面：`loadRecentAssessments()` 中的评测过滤
- ✅ 评测页面：`filterScalesByScene()`

## 预期效果

### 修复前的问题：
- ❌ 场景页面显示用户的所有脑波（不管是否与场景相关）
- ❌ 用户看到不相关的脑波，体验混乱
- ❌ 场景化疗愈体验不完整

### 修复后的改善：
- ✅ 场景页面只显示与当前场景相关的脑波
- ✅ 提供精准的场景化疗愈体验
- ✅ 与其他页面的场景过滤逻辑保持一致
- ✅ 详细的调试日志帮助问题排查

## 测试验证方案

### 测试步骤：

1. **进入场景页面**：
   - 选择一个特定场景（如"睡眠改善"）
   - 确保用户已登录并有脑波历史

2. **检查脑波显示**：
   - 查看AI生成脑波模块
   - 确认显示的脑波与当前场景相关

3. **对比验证**：
   - 进入脑波库页面，进入场景模式
   - 对比两个页面显示的脑波是否一致

4. **控制台日志检查**：
   - 查看过滤日志：`🎯 场景「XXX」脑波历史过滤:`
   - 确认原始数量和场景相关数量的变化

### 预期结果：

- ✅ 场景页面只显示与当前场景匹配的脑波
- ✅ 控制台显示正确的过滤日志
- ✅ 空状态正常显示（如果没有相关脑波）
- ✅ 错误处理正常工作

## 相关文件

**修复文件：**
- `pages/scene/detail/detail.js` - 主要修复文件

**依赖服务：**
- `utils/sceneMappingService.js` - 场景映射服务

**参考实现：**
- `pages/music/library/library.js` - 脑波库的场景过滤实现
- `pages/assessment/scales/scales.js` - 评测页面的场景过滤实现

## 技术细节

### 关键方法调用：
```javascript
sceneMappingService.isMusicMatchingScene(
  brainwave.rawData,    // 脑波数据对象
  this.data.sceneId,    // 当前场景ID
  this.data.sceneName   // 当前场景名称
)
```

### 错误处理：
- 使用 try-catch 包装过滤逻辑
- 过滤失败时保持原始数据显示
- 提供详细的错误日志

### 性能考虑：
- 使用 Promise.all() 并行处理所有脑波的场景匹配
- 只在有场景ID和脑波数据时才执行过滤
- 限制显示数量为10条，减少处理开销

## 结论

这个修复解决了场景页面脑波过滤不生效的问题，确保了：
1. **功能完整性**：场景页面现在具有与其他页面一致的过滤能力
2. **用户体验**：提供精准的场景化脑波推荐
3. **代码一致性**：与其他页面的过滤逻辑保持统一
4. **可维护性**：添加了详细的日志和错误处理

**修复时间：**2025-09-22  
**影响功能：**场景页面AI生成脑波过滤  
**修复状态：**✅ 已完成
