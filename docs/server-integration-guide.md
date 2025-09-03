# 收藏和下载功能服务器端集成指南

## 📋 概述

本文档详细描述了小程序收藏和下载功能所需的服务器端集成要求，包括API接口设计、数据库结构、安全控制和部署建议。

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   小程序端      │    │   服务器API     │    │   文件存储      │
│                 │    │                 │    │                 │
│ 收藏管理器      │◄──►│ 收藏API        │    │ CDN/OSS        │
│ 下载管理器      │◄──►│ 下载API        │◄──►│ 七牛云/阿里云   │
│ 用户界面        │    │ 权限控制        │    │ 文件访问控制    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   数据库        │
                       │                 │
                       │ 收藏表          │
                       │ 下载表          │
                       │ 令牌表          │
                       │ 用户表          │
                       └─────────────────┘
```

## 📡 API接口规范

### 🎯 收藏相关API

#### 1. 添加收藏
```http
POST /api/favorites
Content-Type: application/json
Authorization: Bearer {token}

{
  "user_id": "string",
  "item_id": "string", 
  "item_type": "music|assessment|sequence",
  "item_data": {
    "title": "string",
    "cover": "string", 
    "duration": "number",
    "metadata": "object"
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": "fav_12345",
    "user_id": "user_123",
    "item_id": "music_456",
    "item_type": "music",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. 取消收藏
```http
DELETE /api/favorites/{favorite_id}
Authorization: Bearer {token}
```

**响应示例：**
```json
{
  "success": true,
  "message": "收藏已取消"
}
```

#### 3. 获取收藏列表
```http
GET /api/favorites?user_id={user_id}&type={type}&limit={limit}&offset={offset}
Authorization: Bearer {token}
```

**参数说明：**
- `user_id`: 用户ID
- `type`: 可选，筛选类型 (`music|assessment|sequence`)
- `limit`: 每页数量，默认50
- `offset`: 偏移量，默认0

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "fav_12345",
      "item_id": "music_456",
      "item_type": "music",
      "item_data": {
        "title": "深度放松冥想音乐",
        "cover": "/images/music_456.jpg",
        "duration": 360,
        "category": "冥想"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

#### 4. 批量同步收藏
```http
PUT /api/favorites/sync
Content-Type: application/json
Authorization: Bearer {token}

{
  "user_id": "string",
  "last_sync_time": "datetime",
  "local_changes": [
    {
      "item_id": "string",
      "action": "add|remove",
      "timestamp": "datetime",
      "item_data": "object"
    }
  ]
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "server_favorites": [...],
    "conflicts": [...],
    "sync_time": "2024-01-15T12:30:00Z"
  }
}
```

### 📥 下载相关API

#### 1. 获取下载链接
```http
GET /api/music/download-url/{music_id}?quality={quality}
Authorization: Bearer {token}
```

**参数说明：**
- `music_id`: 音乐ID
- `quality`: 音质选择 (`standard|high|lossless`)

**响应示例：**
```json
{
  "success": true,
  "data": {
    "download_url": "https://cdn.example.com/music/123.mp3?token=abc&expires=1642204800",
    "expires_at": "2024-01-15T18:00:00Z",
    "file_size": 15728640,
    "token": "download_token_123",
    "quality": "standard"
  }
}
```

#### 2. 记录下载
```http
POST /api/downloads
Content-Type: application/json
Authorization: Bearer {token}

{
  "user_id": "string",
  "music_id": "string",
  "file_size": "number",
  "quality": "string",
  "status": "downloading|completed|failed"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": "download_12345",
    "user_id": "user_123",
    "music_id": "music_456",
    "status": "downloading",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. 获取下载记录
```http
GET /api/downloads?user_id={user_id}&status={status}&limit={limit}&offset={offset}
Authorization: Bearer {token}
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "download_12345",
      "music_id": "music_456",
      "music_info": {
        "title": "深度放松冥想音乐",
        "cover": "/images/music_456.jpg"
      },
      "status": "completed",
      "file_size": 15728640,
      "quality": "standard",
      "download_time": "2024-01-15T10:30:00Z",
      "completed_time": "2024-01-15T10:32:15Z"
    }
  ],
  "total": 12,
  "stats": {
    "total_downloads": 12,
    "completed": 10,
    "downloading": 1,
    "failed": 1,
    "total_size_mb": 234.5
  }
}
```

#### 4. 删除下载记录
```http
DELETE /api/downloads/{download_id}
Authorization: Bearer {token}
```

## 🗄️ 数据库设计

### 用户收藏表 (`user_favorites`)

```sql
CREATE TABLE user_favorites (
  id VARCHAR(36) PRIMARY KEY COMMENT '收藏记录ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  item_id VARCHAR(36) NOT NULL COMMENT '收藏项目ID',
  item_type ENUM('music', 'assessment', 'sequence') NOT NULL COMMENT '收藏类型',
  item_data JSON NOT NULL COMMENT '项目详细信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 索引
  UNIQUE KEY unique_user_item (user_id, item_id) COMMENT '用户-项目唯一索引',
  INDEX idx_user_type (user_id, item_type) COMMENT '用户-类型索引',
  INDEX idx_created_at (created_at) COMMENT '创建时间索引',
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收藏表';
```

**字段说明：**
- `item_data`: JSON格式存储，包含title、cover、duration、category等信息
- `item_type`: 区分音乐、评测、长序列等不同类型的收藏

### 用户下载表 (`user_downloads`)

```sql
CREATE TABLE user_downloads (
  id VARCHAR(36) PRIMARY KEY COMMENT '下载记录ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  music_id VARCHAR(36) NOT NULL COMMENT '音乐ID',
  download_token VARCHAR(64) NULL COMMENT '下载令牌',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
  quality ENUM('standard', 'high', 'lossless') DEFAULT 'standard' COMMENT '音质',
  status ENUM('downloading', 'completed', 'failed', 'expired') DEFAULT 'downloading' COMMENT '下载状态',
  progress TINYINT DEFAULT 0 COMMENT '下载进度(0-100)',
  download_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始下载时间',
  completed_time TIMESTAMP NULL COMMENT '完成时间',
  expires_at TIMESTAMP NULL COMMENT '下载链接过期时间',
  error_message TEXT NULL COMMENT '错误信息',
  
  -- 索引
  INDEX idx_user_status (user_id, status) COMMENT '用户-状态索引',
  INDEX idx_download_time (download_time) COMMENT '下载时间索引',
  INDEX idx_expires_at (expires_at) COMMENT '过期时间索引',
  UNIQUE KEY unique_user_music_quality (user_id, music_id, quality) COMMENT '用户-音乐-质量唯一索引',
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (music_id) REFERENCES music_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户下载记录表';
```

### 下载令牌表 (`download_tokens`)

```sql
CREATE TABLE download_tokens (
  id VARCHAR(36) PRIMARY KEY COMMENT '令牌ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  music_id VARCHAR(36) NOT NULL COMMENT '音乐ID',
  token VARCHAR(64) NOT NULL UNIQUE COMMENT '下载令牌',
  download_url TEXT NOT NULL COMMENT '下载链接',
  quality ENUM('standard', 'high', 'lossless') DEFAULT 'standard' COMMENT '音质',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
  max_downloads INT DEFAULT 3 COMMENT '最大下载次数',
  download_count INT DEFAULT 0 COMMENT '已下载次数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  last_accessed_at TIMESTAMP NULL COMMENT '最后访问时间',
  
  -- 索引
  INDEX idx_token (token) COMMENT '令牌索引',
  INDEX idx_expires (expires_at) COMMENT '过期时间索引',
  INDEX idx_user_music (user_id, music_id) COMMENT '用户-音乐索引',
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (music_id) REFERENCES music_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='下载令牌表';
```

### 下载访问日志表 (`download_logs`)

```sql
CREATE TABLE download_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '日志ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  music_id VARCHAR(36) NOT NULL COMMENT '音乐ID',
  download_token VARCHAR(64) NULL COMMENT '使用的令牌',
  ip_address VARCHAR(45) NOT NULL COMMENT 'IP地址',
  user_agent TEXT NULL COMMENT '用户代理',
  download_size BIGINT DEFAULT 0 COMMENT '下载字节数',
  download_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '下载时间',
  status ENUM('started', 'completed', 'failed', 'cancelled') DEFAULT 'started' COMMENT '下载状态',
  error_code VARCHAR(20) NULL COMMENT '错误代码',
  error_message TEXT NULL COMMENT '错误信息',
  
  -- 索引
  INDEX idx_user_time (user_id, download_time) COMMENT '用户-时间索引',
  INDEX idx_music_time (music_id, download_time) COMMENT '音乐-时间索引',
  INDEX idx_ip_time (ip_address, download_time) COMMENT 'IP-时间索引',
  INDEX idx_status (status) COMMENT '状态索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='下载访问日志表';
```

## 🔧 服务器端实现

### Node.js/Express 路由实现

#### 收藏功能路由 (`routes/favorites.js`)

```javascript
const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const FavoriteService = require('../services/FavoriteService')

// 添加收藏
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_type, item_data } = req.body
    const user_id = req.user.id

    // 验证参数
    if (!item_id || !item_type || !item_data) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      })
    }

    // 检查是否已收藏
    const existing = await FavoriteService.checkExisting(user_id, item_id)
    if (existing) {
      return res.status(409).json({
        success: false,
        error: '已经收藏过了'
      })
    }

    // 添加收藏记录
    const favorite = await FavoriteService.addFavorite({
      user_id,
      item_id,
      item_type,
      item_data: JSON.stringify(item_data)
    })

    res.json({
      success: true,
      data: favorite
    })
  } catch (error) {
    console.error('添加收藏失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 获取收藏列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id
    const { type, limit = 50, offset = 0, search } = req.query

    const result = await FavoriteService.getUserFavorites({
      user_id,
      type,
      limit: parseInt(limit),
      offset: parseInt(offset),
      search
    })

    res.json({
      success: true,
      data: result.favorites,
      total: result.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 取消收藏
router.delete('/:favoriteId', authenticateToken, async (req, res) => {
  try {
    const { favoriteId } = req.params
    const user_id = req.user.id

    const success = await FavoriteService.removeFavorite(favoriteId, user_id)
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '收藏记录不存在'
      })
    }

    res.json({
      success: true,
      message: '收藏已取消'
    })
  } catch (error) {
    console.error('取消收藏失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 批量同步收藏
router.put('/sync', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id
    const { last_sync_time, local_changes } = req.body

    const result = await FavoriteService.syncFavorites({
      user_id,
      last_sync_time,
      local_changes
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('同步收藏失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
```

#### 下载功能路由 (`routes/downloads.js`)

```javascript
const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { authenticateToken } = require('../middleware/auth')
const DownloadService = require('../services/DownloadService')
const PermissionService = require('../services/PermissionService')

// 下载限流中间件
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 每分钟最多5次下载请求
  message: {
    success: false,
    error: '下载请求过于频繁，请稍后再试'
  },
  keyGenerator: (req) => req.user.id
})

// 获取下载链接
router.get('/music/download-url/:musicId', 
  authenticateToken, 
  downloadLimiter, 
  async (req, res) => {
    try {
      const { musicId } = req.params
      const { quality = 'standard' } = req.query
      const user_id = req.user.id

      // 检查下载权限
      const permissionCheck = await PermissionService.checkDownloadPermission(
        user_id, 
        musicId, 
        quality
      )
      
      if (!permissionCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: permissionCheck.reason
        })
      }

      // 生成下载链接
      const downloadInfo = await DownloadService.generateDownloadUrl({
        user_id,
        music_id: musicId,
        quality
      })

      // 记录下载请求
      await DownloadService.recordDownloadRequest({
        user_id,
        music_id: musicId,
        token: downloadInfo.token,
        quality
      })

      res.json({
        success: true,
        data: downloadInfo
      })
    } catch (error) {
      console.error('生成下载链接失败:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

// 记录下载状态
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id
    const { music_id, file_size, quality, status } = req.body

    const download = await DownloadService.recordDownload({
      user_id,
      music_id,
      file_size,
      quality,
      status
    })

    res.json({
      success: true,
      data: download
    })
  } catch (error) {
    console.error('记录下载失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 获取下载记录
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id
    const { status, limit = 50, offset = 0 } = req.query

    const result = await DownloadService.getUserDownloads({
      user_id,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    // 获取统计信息
    const stats = await DownloadService.getUserDownloadStats(user_id)

    res.json({
      success: true,
      data: result.downloads,
      total: result.total,
      stats: stats,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('获取下载记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 删除下载记录
router.delete('/:downloadId', authenticateToken, async (req, res) => {
  try {
    const { downloadId } = req.params
    const user_id = req.user.id

    const success = await DownloadService.deleteDownload(downloadId, user_id)
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '下载记录不存在'
      })
    }

    res.json({
      success: true,
      message: '下载记录已删除'
    })
  } catch (error) {
    console.error('删除下载记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
```

### 服务层实现

#### 权限检查服务 (`services/PermissionService.js`)

```javascript
class PermissionService {
  // 检查下载权限
  static async checkDownloadPermission(userId, musicId, quality = 'standard') {
    try {
      // 获取用户信息
      const user = await User.findById(userId)
      if (!user) {
        return { allowed: false, reason: '用户不存在' }
      }

      // 获取音乐信息
      const music = await Music.findById(musicId)
      if (!music) {
        return { allowed: false, reason: '音乐不存在' }
      }

      // 检查音乐是否需要会员权限
      if (music.premium_required && !user.has_premium_access) {
        return { allowed: false, reason: '需要会员权限' }
      }

      // 检查音质权限
      if (quality === 'lossless' && user.subscription_type !== 'vip') {
        return { allowed: false, reason: '无损音质需要VIP会员' }
      }

      // 检查每日下载限制
      const todayDownloads = await this.getTodayDownloadCount(userId)
      const dailyLimit = this.getDailyDownloadLimit(user.subscription_type)
      
      if (todayDownloads >= dailyLimit) {
        return { 
          allowed: false, 
          reason: `每日下载限制${dailyLimit}次，已达上限` 
        }
      }

      // 检查存储空间限制
      const userStorage = await this.getUserStorageUsage(userId)
      const storageLimit = this.getStorageLimit(user.subscription_type)
      
      if (userStorage >= storageLimit) {
        return { 
          allowed: false, 
          reason: '存储空间已满，请清理后重试' 
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('权限检查失败:', error)
      return { allowed: false, reason: '权限检查失败' }
    }
  }

  // 获取每日下载限制
  static getDailyDownloadLimit(subscriptionType) {
    const limits = {
      'free': 5,
      'trial': 20,
      'premium': 100,
      'vip': 500
    }
    return limits[subscriptionType] || limits['free']
  }

  // 获取存储限制 (MB)
  static getStorageLimit(subscriptionType) {
    const limits = {
      'free': 100,      // 100MB
      'trial': 500,     // 500MB
      'premium': 2048,  // 2GB
      'vip': 10240      // 10GB
    }
    return limits[subscriptionType] || limits['free']
  }

  // 获取今日下载次数
  static async getTodayDownloadCount(userId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const count = await Download.count({
      where: {
        user_id: userId,
        status: 'completed',
        completed_time: {
          [Op.gte]: today
        }
      }
    })
    
    return count
  }

  // 获取用户存储使用量
  static async getUserStorageUsage(userId) {
    const result = await Download.findOne({
      where: {
        user_id: userId,
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('file_size')), 'totalSize']
      ]
    })
    
    return Math.round((result?.totalSize || 0) / (1024 * 1024)) // 转换为MB
  }
}

module.exports = PermissionService
```

## 🔐 安全和权限控制

### JWT Token 验证中间件

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '缺少访问令牌'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // 验证用户是否存在且状态正常
    const user = await User.findById(decoded.id)
    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: '用户状态异常'
      })
    }

    req.user = {
      id: decoded.id,
      subscription_type: user.subscription_type,
      has_premium_access: user.has_premium_access
    }
    
    next()
  } catch (error) {
    console.error('Token验证失败:', error)
    return res.status(403).json({
      success: false,
      error: '令牌无效'
    })
  }
}

module.exports = { authenticateToken }
```

### 文件访问控制

```javascript
// services/FileAccessService.js
const crypto = require('crypto')
const qiniu = require('qiniu')

class FileAccessService {
  // 生成安全的下载链接
  static async generateSecureDownloadUrl(musicId, quality, userId) {
    try {
      // 生成唯一令牌
      const token = this.generateDownloadToken(userId, musicId)
      
      // 设置过期时间(6小时)
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000)
      
      // 构建文件路径
      const filePath = this.buildFilePath(musicId, quality)
      
      // 生成CDN签名链接
      const downloadUrl = this.generateCDNUrl(filePath, token, expiresAt)
      
      // 保存令牌记录
      await this.saveDownloadToken({
        userId,
        musicId,
        token,
        downloadUrl,
        quality,
        expiresAt
      })
      
      return {
        download_url: downloadUrl,
        token,
        expires_at: expiresAt,
        quality
      }
    } catch (error) {
      console.error('生成下载链接失败:', error)
      throw new Error('生成下载链接失败')
    }
  }

  // 生成下载令牌
  static generateDownloadToken(userId, musicId) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    const data = `${userId}_${musicId}_${timestamp}_${random}`
    
    return crypto
      .createHash('sha256')
      .update(data + process.env.DOWNLOAD_SECRET)
      .digest('hex')
      .substring(0, 32)
  }

  // 构建文件路径
  static buildFilePath(musicId, quality) {
    const qualityMap = {
      'standard': '128k',
      'high': '320k', 
      'lossless': 'flac'
    }
    
    const qualityStr = qualityMap[quality] || '128k'
    return `music/${musicId}_${qualityStr}.${quality === 'lossless' ? 'flac' : 'mp3'}`
  }

  // 生成CDN签名链接(七牛云示例)
  static generateCDNUrl(filePath, token, expiresAt) {
    const mac = new qiniu.auth.digest.Mac(
      process.env.QINIU_ACCESS_KEY,
      process.env.QINIU_SECRET_KEY
    )
    
    const domain = process.env.QINIU_DOMAIN
    const deadline = Math.floor(expiresAt.getTime() / 1000)
    
    // 生成带有自定义参数的私有链接
    const baseUrl = `${domain}/${filePath}`
    const urlWithParams = `${baseUrl}?token=${token}&deadline=${deadline}`
    
    return qiniu.util.privateDownloadUrl(mac, urlWithParams, deadline)
  }

  // 保存下载令牌
  static async saveDownloadToken(tokenData) {
    const DownloadToken = require('../models/DownloadToken')
    
    await DownloadToken.create({
      id: this.generateId(),
      user_id: tokenData.userId,
      music_id: tokenData.musicId,
      token: tokenData.token,
      download_url: tokenData.downloadUrl,
      quality: tokenData.quality,
      expires_at: tokenData.expiresAt
    })
  }

  // 验证下载令牌
  static async validateDownloadToken(token) {
    const DownloadToken = require('../models/DownloadToken')
    
    const tokenRecord = await DownloadToken.findOne({
      where: { token },
      include: ['user', 'music']
    })
    
    if (!tokenRecord) {
      return { valid: false, reason: '令牌不存在' }
    }
    
    if (new Date() > tokenRecord.expires_at) {
      return { valid: false, reason: '令牌已过期' }
    }
    
    if (tokenRecord.download_count >= tokenRecord.max_downloads) {
      return { valid: false, reason: '下载次数超限' }
    }
    
    return { valid: true, data: tokenRecord }
  }

  // 生成唯一ID
  static generateId() {
    return 'dl_' + crypto.randomBytes(16).toString('hex')
  }
}

module.exports = FileAccessService
```

## ☁️ 文件存储配置

### 七牛云配置示例

```javascript
// config/qiniu.js
const qiniu = require('qiniu')

const config = {
  accessKey: process.env.QINIU_ACCESS_KEY,
  secretKey: process.env.QINIU_SECRET_KEY,
  bucket: process.env.QINIU_BUCKET,
  domain: process.env.QINIU_DOMAIN,
  zone: qiniu.zone.Zone_z0 // 根据实际存储区域调整
}

// 初始化配置
const qiniuConfig = new qiniu.conf.Config()
qiniuConfig.zone = config.zone
qiniuConfig.useHttpsDomain = true
qiniuConfig.useCdnDomain = true

// MAC验证
const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)

// 生成上传凭证
const generateUploadToken = (key) => {
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${config.bucket}:${key}`,
    expires: 3600 // 1小时过期
  })
  return putPolicy.uploadToken(mac)
}

// 生成私有下载链接
const generatePrivateUrl = (key, deadline) => {
  const privateDownloadUrl = qiniu.util.privateDownloadUrl(
    mac,
    `${config.domain}/${key}`,
    deadline
  )
  return privateDownloadUrl
}

module.exports = {
  config,
  mac,
  generateUploadToken,
  generatePrivateUrl
}
```

### 阿里云OSS配置示例

```javascript
// config/oss.js
const OSS = require('ali-oss')

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  secure: true // 使用HTTPS
})

// 生成签名URL
const generateSignedUrl = async (objectName, expires = 3600) => {
  try {
    const url = await client.signatureUrl(objectName, {
      expires, // 过期时间(秒)
      method: 'GET'
    })
    return url
  } catch (error) {
    console.error('生成签名URL失败:', error)
    throw error
  }
}

// 检查文件是否存在
const checkFileExists = async (objectName) => {
  try {
    await client.head(objectName)
    return true
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return false
    }
    throw error
  }
}

// 获取文件信息
const getFileInfo = async (objectName) => {
  try {
    const result = await client.head(objectName)
    return {
      size: parseInt(result.res.headers['content-length']),
      lastModified: result.res.headers['last-modified'],
      contentType: result.res.headers['content-type']
    }
  } catch (error) {
    console.error('获取文件信息失败:', error)
    throw error
  }
}

module.exports = {
  client,
  generateSignedUrl,
  checkFileExists,
  getFileInfo
}
```

## 🔄 定时任务

### 清理任务 (`tasks/cleanup.js`)

```javascript
const cron = require('node-cron')
const DownloadToken = require('../models/DownloadToken')
const Download = require('../models/Download')
const { Op } = require('sequelize')

class CleanupTasks {
  // 启动所有定时任务
  static startAll() {
    this.cleanupExpiredTokens()
    this.cleanupFailedDownloads()
    this.updateDownloadStats()
    this.generateReports()
  }

  // 清理过期的下载令牌 - 每小时执行
  static cleanupExpiredTokens() {
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('开始清理过期令牌...')
        
        const expiredCount = await DownloadToken.destroy({
          where: {
            expires_at: {
              [Op.lt]: new Date()
            }
          }
        })
        
        console.log(`清理了 ${expiredCount} 个过期令牌`)
      } catch (error) {
        console.error('清理过期令牌失败:', error)
      }
    })
  }

  // 清理失败的下载记录 - 每天凌晨2点执行
  static cleanupFailedDownloads() {
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('开始清理失败的下载记录...')
        
        // 清理7天前的失败记录
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const failedCount = await Download.destroy({
          where: {
            status: 'failed',
            download_time: {
              [Op.lt]: sevenDaysAgo
            }
          }
        })
        
        console.log(`清理了 ${failedCount} 个失败的下载记录`)
      } catch (error) {
        console.error('清理失败下载记录失败:', error)
      }
    })
  }

  // 更新下载统计 - 每6小时执行
  static updateDownloadStats() {
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('开始更新下载统计...')
        
        // 这里可以更新用户的下载统计缓存
        // 比如总下载量、热门下载等统计数据
        
        console.log('下载统计更新完成')
      } catch (error) {
        console.error('更新下载统计失败:', error)
      }
    })
  }

  // 生成每日报告 - 每天上午9点执行
  static generateReports() {
    cron.schedule('0 9 * * *', async () => {
      try {
        console.log('开始生成每日报告...')
        
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(0, 0, 0, 0)
        
        const today = new Date(yesterday)
        today.setDate(today.getDate() + 1)
        
        // 统计昨日数据
        const stats = await this.generateDailyStats(yesterday, today)
        
        // 保存报告或发送通知
        console.log('每日报告:', stats)
        
      } catch (error) {
        console.error('生成每日报告失败:', error)
      }
    })
  }

  // 生成每日统计
  static async generateDailyStats(startDate, endDate) {
    const [downloadStats, favoriteStats] = await Promise.all([
      // 下载统计
      Download.findAll({
        where: {
          download_time: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('file_size')), 'totalSize']
        ],
        group: ['status'],
        raw: true
      }),
      
      // 收藏统计
      Favorite.count({
        where: {
          created_at: {
            [Op.between]: [startDate, endDate]
          }
        }
      })
    ])
    
    return {
      date: startDate.toISOString().split('T')[0],
      downloads: downloadStats,
      new_favorites: favoriteStats
    }
  }
}

module.exports = CleanupTasks
```

## 📊 监控和日志

### 下载监控服务

```javascript
// services/MonitoringService.js
class MonitoringService {
  // 记录下载事件
  static async logDownloadEvent(eventData) {
    const DownloadLog = require('../models/DownloadLog')
    
    try {
      await DownloadLog.create({
        user_id: eventData.userId,
        music_id: eventData.musicId,
        download_token: eventData.token,
        ip_address: eventData.ip,
        user_agent: eventData.userAgent,
        download_size: eventData.downloadSize || 0,
        status: eventData.status,
        error_code: eventData.errorCode,
        error_message: eventData.errorMessage
      })
    } catch (error) {
      console.error('记录下载日志失败:', error)
    }
  }

  // 获取下载统计
  static async getDownloadStats(timeRange = '24h') {
    const DownloadLog = require('../models/DownloadLog')
    const { Op } = require('sequelize')
    
    const timeRanges = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    }
    
    const hours = timeRanges[timeRange] || 24
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const stats = await DownloadLog.findAll({
      where: {
        download_time: {
          [Op.gte]: startTime
        }
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('download_size')), 'totalSize']
      ],
      group: ['status'],
      raw: true
    })
    
    return stats
  }

  // 获取热门下载
  static async getPopularDownloads(limit = 10) {
    const DownloadLog = require('../models/DownloadLog')
    const { Op } = require('sequelize')
    
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    const popular = await DownloadLog.findAll({
      where: {
        download_time: {
          [Op.gte]: lastWeek
        },
        status: 'completed'
      },
      attributes: [
        'music_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'downloadCount']
      ],
      group: ['music_id'],
      order: [[sequelize.literal('downloadCount'), 'DESC']],
      limit: limit,
      raw: true
    })
    
    return popular
  }

  // 检查异常下载行为
  static async detectAbnormalDownloads() {
    const DownloadLog = require('../models/DownloadLog')
    const { Op } = require('sequelize')
    
    const lastHour = new Date(Date.now() - 60 * 60 * 1000)
    
    // 检查单个IP的频繁下载
    const suspiciousIPs = await DownloadLog.findAll({
      where: {
        download_time: {
          [Op.gte]: lastHour
        }
      },
      attributes: [
        'ip_address',
        'user_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount']
      ],
      group: ['ip_address', 'user_id'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('id')), 
        Op.gt, 
        50 // 每小时超过50次下载请求
      ),
      raw: true
    })
    
    if (suspiciousIPs.length > 0) {
      console.warn('发现异常下载行为:', suspiciousIPs)
      // 这里可以发送告警或自动封禁
    }
    
    return suspiciousIPs
  }
}

module.exports = MonitoringService
```

## 🚀 部署配置

### Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 应用服务
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - QINIU_ACCESS_KEY=${QINIU_ACCESS_KEY}
      - QINIU_SECRET_KEY=${QINIU_SECRET_KEY}
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  # 数据库服务
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    restart: unless-stopped

  # Redis缓存服务
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

### Nginx 配置

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # 限制请求频率
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=download:10m rate=10r/m;

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # API接口
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 下载接口特殊限制
        location /api/downloads/ {
            limit_req zone=download burst=5 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # 健康检查
        location /health {
            proxy_pass http://app;
            access_log off;
        }
    }
}
```

### 环境变量配置

```bash
# .env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=music_app
DB_USER=music_user
DB_PASSWORD=secure_password
DB_ROOT_PASSWORD=root_password

# Redis配置
REDIS_URL=redis://localhost:6379

# JWT配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# 七牛云配置
QINIU_ACCESS_KEY=your_qiniu_access_key
QINIU_SECRET_KEY=your_qiniu_secret_key
QINIU_BUCKET=music-files
QINIU_DOMAIN=https://cdn.yourdomain.com

# 下载配置
DOWNLOAD_SECRET=your-download-secret-key
MAX_DOWNLOAD_SIZE=50MB
DOWNLOAD_TOKEN_EXPIRES=6h

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 监控配置
ENABLE_MONITORING=true
ALERT_EMAIL=admin@yourdomain.com
```

## 📈 性能优化建议

### 1. 数据库优化
- 为频繁查询的字段创建合适的索引
- 使用数据库连接池
- 对大表进行分区
- 定期清理过期数据

### 2. 缓存策略
```javascript
// Redis缓存示例
const redis = require('redis')
const client = redis.createClient(process.env.REDIS_URL)

// 缓存用户收藏列表
const cacheUserFavorites = async (userId, favorites) => {
  const key = `user:${userId}:favorites`
  await client.setEx(key, 3600, JSON.stringify(favorites)) // 1小时过期
}

// 获取缓存的收藏列表
const getCachedFavorites = async (userId) => {
  const key = `user:${userId}:favorites`
  const cached = await client.get(key)
  return cached ? JSON.parse(cached) : null
}
```

### 3. 文件存储优化
- 使用CDN加速文件访问
- 实现智能缓存策略
- 支持断点续传下载
- 文件压缩和格式优化

### 4. 监控和告警
- 实时监控API响应时间
- 监控下载成功率
- 设置异常行为告警
- 定期生成性能报告

## 🔧 小程序端配置更新

需要在小程序的配置文件中添加新的API调用：

```javascript
// utils/api.js 中添加收藏和下载API
const API_BASE = 'https://api.yourdomain.com'

const FavoritesAPI = {
  add: (data) => request('/api/favorites', 'POST', data),
  remove: (id) => request(`/api/favorites/${id}`, 'DELETE'),
  list: (params) => request('/api/favorites', 'GET', params),
  sync: (data) => request('/api/favorites/sync', 'PUT', data)
}

const DownloadAPI = {
  getUrl: (musicId, quality) => request(`/api/music/download-url/${musicId}?quality=${quality}`, 'GET'),
  record: (data) => request('/api/downloads', 'POST', data),
  list: (params) => request('/api/downloads', 'GET', params),
  delete: (id) => request(`/api/downloads/${id}`, 'DELETE')
}

module.exports = {
  FavoritesAPI,
  DownloadAPI
}
```

## 📚 总结

通过以上服务器端集成，您的小程序将获得：

✅ **完整的收藏系统** - 支持多端同步的收藏功能
✅ **安全的下载服务** - 基于令牌的文件访问控制
✅ **权限管理体系** - 基于订阅类型的差异化服务
✅ **监控和日志** - 完善的运营数据统计
✅ **高性能架构** - 支持高并发的服务设计
✅ **安全防护机制** - 防刷防盗链等安全措施

这套完整的解决方案将为您的音乐疗愈小程序提供稳定可靠的后端支持！
