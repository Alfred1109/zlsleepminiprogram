# 用户信息持久化 - 数据库表结构建议

## 📋 问题分析

前端代码中使用了以下用户信息字段来实现微信昵称头像持久化：

### 前端使用的字段：
- `nickname` - 用户昵称（微信昵称）
- `avatar_url` - 用户头像URL（微信头像）  
- `username` - 用户名（登录名）
- `openid` - 微信openid
- `unionid` - 微信unionid（可选）

### API接口：
- **GET** `/user/info` - 获取完整用户信息
- **PUT** `/auth/user/update` - 更新用户信息

## 🗄️ 数据库表结构建议

### 1. 用户表 (users) - 必须包含的字段

```sql
CREATE TABLE `users` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT '用户ID (UUID)',
  `username` VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名/登录账号',
  `password` VARCHAR(255) NULL COMMENT '密码哈希（微信登录可为空）',
  
  -- 基本信息字段（重点）
  `nickname` VARCHAR(50) NULL COMMENT '用户昵称（微信昵称）',
  `avatar_url` TEXT NULL COMMENT '头像URL（微信头像）',
  `phone` VARCHAR(20) NULL COMMENT '手机号',
  `email` VARCHAR(100) NULL COMMENT '邮箱',
  
  -- 微信相关字段（重点）
  `openid` VARCHAR(64) NULL UNIQUE COMMENT '微信OpenID',
  `unionid` VARCHAR(64) NULL COMMENT '微信UnionID',
  `wechat_session_key` VARCHAR(64) NULL COMMENT '微信SessionKey（加密存储）',
  
  -- 用户状态字段
  `is_guest` BOOLEAN DEFAULT FALSE COMMENT '是否游客用户',
  `status` ENUM('active', 'disabled', 'pending') DEFAULT 'active' COMMENT '用户状态',
  `email_verified` BOOLEAN DEFAULT FALSE COMMENT '邮箱是否验证',
  `phone_verified` BOOLEAN DEFAULT FALSE COMMENT '手机是否验证',
  
  -- 订阅相关字段
  `subscription_type` ENUM('free', 'trial', 'premium', 'vip') DEFAULT 'free' COMMENT '订阅类型',
  `subscription_status` ENUM('active', 'inactive', 'expired', 'cancelled') DEFAULT 'inactive' COMMENT '订阅状态',
  `subscription_start_date` TIMESTAMP NULL COMMENT '订阅开始时间',
  `subscription_end_date` TIMESTAMP NULL COMMENT '订阅结束时间', 
  `trial_used` BOOLEAN DEFAULT FALSE COMMENT '是否已使用试用期',
  `trial_end_date` TIMESTAMP NULL COMMENT '试用期结束时间',
  
  -- 权限相关
  `role_id` INT NULL COMMENT '角色ID',
  `permissions` JSON NULL COMMENT '用户权限（JSON数组）',
  
  -- 设备和登录信息
  `device_id` VARCHAR(64) NULL COMMENT '设备ID',
  `last_login` TIMESTAMP NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) NULL COMMENT '最后登录IP',
  `login_count` INT DEFAULT 0 COMMENT '登录次数',
  
  -- 时间戳
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` TIMESTAMP NULL COMMENT '软删除时间',
  
  -- 索引
  INDEX `idx_username` (`username`),
  INDEX `idx_openid` (`openid`),
  INDEX `idx_unionid` (`unionid`),
  INDEX `idx_phone` (`phone`),
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status`),
  INDEX `idx_subscription` (`subscription_type`, `subscription_status`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_last_login` (`last_login`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

## 🔍 关键字段说明

### ⭐ 必须确保存在的字段（用于微信昵称头像持久化）：

1. **`nickname` VARCHAR(50) NULL** 
   - 存储微信昵称
   - 前端通过 `UserAPI.updateUserInfo()` 更新
   - 登录时通过 `/user/info` 接口返回

2. **`avatar_url` TEXT NULL**
   - 存储微信头像URL
   - 支持较长的URL
   - 前端自动同步微信头像

3. **`openid` VARCHAR(64) NULL UNIQUE**
   - 微信用户唯一标识
   - 用于微信登录身份验证
   - 必须唯一

4. **`unionid` VARCHAR(64) NULL**
   - 微信开放平台统一标识
   - 可选字段，用于跨应用用户识别

## 🚀 后端接口更新建议

### 1. GET `/user/info` - 用户信息获取接口

**响应格式：**
```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "username": "user123",
    "nickname": "微信昵称",          // ⭐ 重点：从数据库返回
    "avatar_url": "https://...",    // ⭐ 重点：从数据库返回
    "phone": "13800138000",
    "email": "user@example.com",
    "openid": "wx_openid_123",
    "unionid": "wx_unionid_456",
    "is_guest": false,
    "subscription_type": "premium",
    "subscription_status": "active",
    "subscription_start_date": "2025-01-01T00:00:00Z",
    "subscription_end_date": "2025-12-31T23:59:59Z",
    "trial_used": true,
    "trial_end_date": "2025-01-08T00:00:00Z",
    "permissions": ["user", "premium"],
    "role_id": 2,
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2025-01-15T10:30:00Z"
  }
}
```

### 2. PUT `/auth/user/update` - 用户信息更新接口

**请求格式：**
```json
{
  "user_id": "user_uuid",
  "nickname": "新的微信昵称",        // ⭐ 重点：保存到数据库
  "avatar_url": "https://新头像URL"  // ⭐ 重点：保存到数据库
}
```

**响应格式：**
```json
{
  "success": true,
  "message": "用户信息更新成功",
  "data": {
    "id": "user_uuid",
    "nickname": "新的微信昵称",
    "avatar_url": "https://新头像URL",
    "updated_at": "2025-01-15T10:35:00Z"
  }
}
```

## ⚠️ 数据库更新检查清单

### 现有系统检查：

1. **检查表是否存在：**
   ```sql
   SHOW TABLES LIKE 'users';
   ```

2. **检查关键字段是否存在：**
   ```sql
   DESCRIBE users;
   -- 或
   SHOW COLUMNS FROM users;
   ```

3. **检查必须字段（如果不存在需要添加）：**
   ```sql
   -- 添加昵称字段
   ALTER TABLE users ADD COLUMN `nickname` VARCHAR(50) NULL COMMENT '用户昵称（微信昵称）';
   
   -- 添加头像字段  
   ALTER TABLE users ADD COLUMN `avatar_url` TEXT NULL COMMENT '头像URL（微信头像）';
   
   -- 添加微信字段
   ALTER TABLE users ADD COLUMN `openid` VARCHAR(64) NULL UNIQUE COMMENT '微信OpenID';
   ALTER TABLE users ADD COLUMN `unionid` VARCHAR(64) NULL COMMENT '微信UnionID';
   ```

4. **添加索引（提升查询性能）：**
   ```sql
   ALTER TABLE users ADD INDEX `idx_openid` (`openid`);
   ALTER TABLE users ADD INDEX `idx_unionid` (`unionid`);
   ```

## 🔄 数据迁移建议

如果字段已存在但可能有数据不一致的问题：

```sql
-- 1. 检查空昵称的用户（使用username作为默认昵称）
UPDATE users 
SET nickname = username 
WHERE nickname IS NULL OR nickname = '';

-- 2. 检查头像字段的数据格式
SELECT id, username, avatar_url 
FROM users 
WHERE avatar_url IS NOT NULL 
LIMIT 10;

-- 3. 清理无效的头像URL
UPDATE users 
SET avatar_url = NULL 
WHERE avatar_url = '' OR avatar_url = '/images/default-avatar.svg';
```

## ✅ 验证测试

更新完成后，测试以下场景：

1. **微信登录** → 检查 `openid` 是否正确存储
2. **获取用户信息** → 检查 `nickname` 和 `avatar_url` 是否返回
3. **更新用户信息** → 检查修改后的昵称头像是否保存到数据库
4. **重新登录** → 检查昵称头像是否从数据库正确加载

---

## 🎯 总结

**最关键的4个字段：**
- ✅ `nickname` - 微信昵称持久化
- ✅ `avatar_url` - 微信头像持久化  
- ✅ `openid` - 微信登录标识
- ✅ `unionid` - 跨应用用户统一（可选）

确保这些字段存在并正确配置后，前端的微信昵称头像持久化功能就能正常工作了！
