# 场景API接口文档 - 前后端对齐版

## 📋 接口清单

### 🎯 场景相关接口 (前端主要使用)

#### 1. 获取场景列表
```
GET /api/scene/list
```

**响应字段:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "sleep",
      "name": "助眠场景", 
      "description": "帮助用户放松身心，快速入眠的疗愈场景",
      "icon": "🌙",
      "sort_order": 1,
      "is_active": true,
      "is_system": true,
      "created_at": "2025-09-20T08:49:33.594482",
      "updated_at": "2025-09-20T08:49:33.594490",
      "scale_mappings_count": 2,
      "music_mappings_count": 2
    }
  ],
  "total": 5
}
```

---

#### 2. 获取场景详情 (🔥 统一接口)
```
GET /api/scene/{scene_code}
GET /api/scene/{scene_id}
```

**参数说明:**
- `scene_code`: 场景代码，如 "sleep"、"focus"、"emotion"
- `scene_id`: 场景数字ID，如 1、2、3

**响应字段:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "sleep",
    "name": "助眠场景",
    "description": "帮助用户放松身心，快速入眠的疗愈场景",
    "icon": "🌙",
    "sort_order": 1,
    "is_active": true,
    "is_system": true,
    "created_at": "2025-09-20T08:49:33.594482",
    "updated_at": "2025-09-20T08:49:33.594490",
    
    // 📊 量表信息 (统一字段命名)
    "assessment_scales": [
      {
        "scale_id": 1,
        "scale_name": "汉密尔顿抑郁量表-17项",
        "scale_type": "international", 
        "description": "用于评估抑郁症状严重程度的标准化量表",
        "weight": 1.0,
        "is_primary": false
      }
    ],
    
    // 🎵 音乐分类信息 (统一字段命名)
    "music_categories": [
      {
        "category_id": 1,
        "category_name": "助眠疗愈",
        "category_code": "natural_sound",
        "description": "大自然的真实声音，如雨声、海浪声、森林声",
        "icon": "🌿",
        "weight": 1.0,
        "is_primary": true
      }
    ]
  }
}
```

---

#### 3. 获取场景映射配置
```
GET /api/scene/mappings
```

**响应字段:**
```json
{
  "success": true,
  "data": {
    "sceneToScales": {
      "1": [1, 3],
      "2": [],
      "3": [2]
    },
    "sceneToMusic": {
      "1": [1, 5],
      "2": [2, 4],
      "3": [3, 5]
    },
    "sceneNameToScales": {
      "助眠场景": [1, 3],
      "专注场景": [],
      "情绪调节场景": [2]
    },
    "sceneNameToMusic": {
      "助眠场景": [1, 5],
      "专注场景": [2, 4],
      "情绪调节场景": [3, 5]
    }
  },
  "meta": {
    "scenes": [
      {"id": 1, "name": "助眠场景", "code": "sleep"},
      {"id": 2, "name": "专注场景", "code": "focus"}
    ],
    "generated_at": "2025-09-24T11:48:33.123456",
    "total_scenes": 5
  }
}
```

---

#### 4. 场景推荐
```
POST /api/scene/recommend
```

**请求参数:**
```json
{
  "assessment_type": "PSQI",
  "score": 12
}
```

**响应字段:**
```json
{
  "success": true,
  "data": {
    "recommended_scene": {
      "code": "sleep",
      "name": "助眠场景", 
      "description": "帮助用户放松身心，快速入眠的疗愈场景",
      "icon": "🌙"
    },
    "assessment_info": {
      "type": "PSQI",
      "score": 12
    },
    "recommended_music": [
      {
        "id": 1,
        "name": "助眠疗愈",
        "code": "natural_sound",
        "weight": 1.0,
        "is_primary": true
      }
    ],
    "recommendation_reason": "根据您的睡眠质量评估（得分12），推荐使用助眠场景来改善睡眠"
  }
}
```

---

#### 5. 初始化场景配置 (管理接口)
```
POST /api/scene/initialize
```

**响应字段:**
```json
{
  "success": true,
  "message": "场景初始化完成",
  "data": {
    "created_scenes": 5,
    "created_mappings": 8
  }
}
```

---

## 🔑 字段命名标准

### ✅ 统一的字段命名规范

#### 量表相关字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `scale_id` | number | 量表ID |
| `scale_name` | string | 量表名称 |
| `scale_type` | string | 量表类型 |

#### 音乐分类相关字段  
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `category_id` | number | 音乐分类ID |
| `category_name` | string | 音乐分类名称 |
| `category_code` | string | 音乐分类代码 |

#### 场景基础字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 场景ID |
| `code` | string | 场景代码 |
| `name` | string | 场景名称 |
| `description` | string | 场景描述 |
| `icon` | string | 场景图标 |
| `sort_order` | number | 排序权重 |
| `is_active` | boolean | 是否启用 |
| `is_system` | boolean | 是否系统场景 |
| `weight` | number | 映射权重 |
| `is_primary` | boolean | 是否主要映射 |

---

## ❌ 已废弃的接口

以下接口已完全删除，不再提供服务：

```
❌ GET /api/scene/{scene_id}/scale-types   (404)
❌ GET /api/scene/{scene_id}/music-types   (404)
```

**迁移方案:** 统一使用 `GET /api/scene/{scene_code}` 获取完整场景信息

---

## 🔄 前端迁移建议

### 1. 更新字段名引用
```javascript
// ❌ 旧字段名
const scaleId = scale.id;
const scaleName = scale.name;
const scaleType = scale.type;

// ✅ 新字段名
const scaleId = scale.scale_id;
const scaleName = scale.scale_name;
const scaleType = scale.scale_type;
```

### 2. 合并接口调用
```javascript
// ❌ 旧方式：多次请求
const sceneData = await fetch(`/api/scene/${sceneCode}`);
const scaleData = await fetch(`/api/scene/${sceneId}/scale-types`);
const musicData = await fetch(`/api/scene/${sceneId}/music-types`);

// ✅ 新方式：一次请求
const completeData = await fetch(`/api/scene/${sceneCode}`);
const { assessment_scales, music_categories } = completeData.data;
```

### 3. 使用TypeScript类型定义
```typescript
interface SceneDetail {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  assessment_scales: AssessmentScale[];
  music_categories: MusicCategory[];
}

interface AssessmentScale {
  scale_id: number;
  scale_name: string;
  scale_type: string;
  description: string;
  weight: number;
  is_primary: boolean;
}

interface MusicCategory {
  category_id: number;
  category_name: string;
  category_code: string;
  description: string;
  icon: string;
  weight: number;
  is_primary: boolean;
}
```

---

## 🎯 接口使用示例

### 获取助眠场景完整信息
```javascript
// 支持代码和ID两种方式
const response1 = await fetch('/api/scene/sleep');
const response2 = await fetch('/api/scene/1');

const sceneData = response1.data;
const scales = sceneData.assessment_scales;
const music = sceneData.music_categories;
```

### 遍历量表信息
```javascript
sceneData.assessment_scales.forEach(scale => {
  console.log(`量表: ${scale.scale_name} (ID: ${scale.scale_id})`);
  console.log(`类型: ${scale.scale_type}`);
  console.log(`权重: ${scale.weight}`);
});
```

### 遍历音乐分类
```javascript
sceneData.music_categories.forEach(category => {
  console.log(`音乐: ${category.category_name} (${category.category_code})`);
  console.log(`主要分类: ${category.is_primary}`);
});
```

---

## 📱 响应状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 404 | 场景不存在或已废弃的接口 |
| 500 | 服务器内部错误 |

---

## 🔗 Base URL

- 生产环境: `https://medsleep.cn`
- 开发环境: `http://localhost:5000`

---

> 🎯 **重点提醒:** 所有字段命名已完全统一，前端只需要适配一套字段标准即可！
