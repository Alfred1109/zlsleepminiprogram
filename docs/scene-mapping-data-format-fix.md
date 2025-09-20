# 场景映射数据格式兼容性修复

## 🎯 问题描述

用户反馈后端API已经实现，但是出现了新的错误：

```javascript
❌ 场景量表过滤失败，显示所有量表: TypeError: mappedType.includes is not a function
```

**根本原因**：后端返回的映射数据格式与前端期望不匹配
- **前端期望**：字符串数组 `["HAMD", "HAMD-17"]`
- **后端实际返回**：对象数组 `[{...}, {...}]`

## 🔧 解决方案

### 1. 添加数据格式处理方法

新增了两个辅助方法来处理不同的数据格式：

#### `extractScaleType(mappedItem)`
```javascript
extractScaleType(mappedItem) {
  if (typeof mappedItem === 'string') {
    return mappedItem  // 直接返回字符串
  }
  
  if (typeof mappedItem === 'object' && mappedItem !== null) {
    // 从对象中提取量表类型
    return mappedItem.scale_type || 
           mappedItem.type || 
           mappedItem.name || 
           mappedItem.code || 
           mappedItem.id ||
           null
  }
  
  return null
}
```

#### `extractMusicType(mappedItem)`
```javascript
extractMusicType(mappedItem) {
  if (typeof mappedItem === 'string') {
    return mappedItem  // 直接返回字符串
  }
  
  if (typeof mappedItem === 'object' && mappedItem !== null) {
    // 从对象中提取音乐类型
    return mappedItem.music_type || 
           mappedItem.type || 
           mappedItem.name || 
           mappedItem.category || 
           mappedItem.tag ||
           mappedItem.code || 
           mappedItem.id ||
           null
  }
  
  return null
}
```

### 2. 更新匹配逻辑

#### 修复前：
```javascript
const matches = scaleTypes.some(mappedType => {
  // 直接使用 mappedType.includes() - 如果是对象会报错
  return scaleType.includes(mappedType) || mappedType.includes(scaleType)
})
```

#### 修复后：
```javascript
const matches = scaleTypes.some(mappedItem => {
  // 先提取类型，再进行匹配
  const mappedType = this.extractScaleType(mappedItem)
  if (!mappedType) return false
  
  // 精确匹配
  if (scaleType === mappedType) return true
  
  // 模糊匹配
  if (scaleType && mappedType) {
    return scaleType.includes(mappedType) || mappedType.includes(scaleType)
  }
  
  return false
})
```

### 3. 增强调试日志

添加了详细的调试信息：

```javascript
// 数据格式调试
console.log('🔍 调试映射数据格式:')
console.log('- sceneToScales[1] 格式:', this.mappings.sceneToScales[1])
console.log('- sceneToScales[1] 类型:', Array.isArray(...) ? 'array' : typeof ...)

// 类型提取调试
console.log('🔍 提取量表类型(对象):', { 
  原始对象: mappedItem, 
  提取结果: extracted 
})
```

## 🎉 兼容的数据格式

现在系统可以处理多种后端数据格式：

### 字符串数组格式（原期望）
```json
{
  "sceneToScales": {
    "1": ["HAMD", "HAMD-17"]
  }
}
```

### 对象数组格式（后端实际）
```json
{
  "sceneToScales": {
    "1": [
      {"scale_type": "HAMD", "name": "汉密尔顿抑郁量表"},
      {"scale_type": "HAMD-17", "name": "汉密尔顿抑郁量表-17项"}
    ]
  }
}
```

### 混合格式
```json
{
  "sceneToScales": {
    "1": ["HAMD", {"scale_type": "HAMD-17"}]
  }
}
```

## 📊 支持的字段名称

系统会按优先级尝试从对象中提取类型：

### 量表类型提取优先级：
1. `scale_type`
2. `type`
3. `name`
4. `code`
5. `id`

### 音乐类型提取优先级：
1. `music_type`
2. `type`
3. `name`
4. `category`
5. `tag`
6. `code`
7. `id`

## 🔍 调试方法

### 1. 查看控制台日志
- `🔍 调试映射数据格式` - 显示后端返回的原始数据结构
- `🔍 提取量表类型` - 显示类型提取过程
- `🔍 量表匹配` - 显示匹配结果

### 2. 使用测试页面
访问 `pages/scene-mapping-test/scene-mapping-test` 进行完整的功能测试

### 3. 检查映射服务状态
```javascript
console.log(sceneMappingService.getDebugInfo())
```

## ✅ 验证结果

修复后的预期日志：
```javascript
✅ 场景映射关系获取成功: {...}
🔍 调试映射数据格式: [详细格式信息]
🔍 提取量表类型(对象): [提取过程]
🎯 场景1映射到评测量表: [成功提取的类型]
🔍 量表匹配: true
```

## 🚀 优势

1. **向后兼容**：支持原有的字符串数组格式
2. **向前兼容**：支持新的对象数组格式
3. **容错能力**：优雅处理各种异常格式
4. **易于调试**：详细的日志输出
5. **可扩展性**：容易添加新的字段支持

---

**修复时间**: 2025-09-20  
**版本**: 1.1  
**状态**: 已修复  
**影响**: 前端完全兼容后端API数据格式
