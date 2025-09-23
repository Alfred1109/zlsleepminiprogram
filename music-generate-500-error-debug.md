# 音乐生成接口500错误调试指南

## 问题描述
`/music/generate` 接口返回500错误，小程序端重试3次都失败。

## 小程序端状态（已确认正常）
- ✅ Token验证：通过，长度297字符
- ✅ 认证头：Bearer token正确添加
- ✅ 网络连接：正常，能够发起请求
- ✅ 请求超时：设置90秒，适合长时间生成任务
- ✅ 重试机制：自动重试3次

## 后端需要检查的问题

### 1. 服务器日志检查（优先级：高）
```bash
# 检查应用服务器错误日志
tail -f /var/log/your-app/error.log | grep -i "music/generate"
tail -f /var/log/your-app/application.log | grep -E "(500|error|exception)"

# 检查Nginx错误日志
tail -f /var/log/nginx/error.log

# 检查系统日志
journalctl -f -u your-app-service
```

### 2. 数据库连接检查
```bash
# 检查数据库连接
# 验证以下表是否存在且可访问：
# - assessments 表 (评测记录)
# - music_generations 表 (音乐生成记录)
# - users 表 (用户信息)

# 测试数据库查询
SELECT * FROM assessments WHERE id = ? LIMIT 1;
SELECT * FROM users WHERE id = ? LIMIT 1;
```

### 3. AI服务/第三方API检查
```bash
# 检查音乐生成AI服务是否正常
# 可能涉及的服务：
# - 音频生成AI API
# - 文件存储服务
# - CDN服务

# 测试AI服务连通性
curl -X POST "AI_SERVICE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"test": "connection"}'
```

### 4. 请求参数验证

根据小程序发送的数据结构，后端应该接收：

**综合生成模式（当前错误场景）：**
```json
{
  "assessment_id": 123,
  "assessment_ids": [123, 456],
  "generation_mode": "comprehensive",
  "scene_context": {
    "scene_id": "xxx",
    "scene_name": "xxx"
  }
}
```

**单一生成模式：**
```json
{
  "assessment_id": 123
}
```

### 5. 可能的问题点

#### A. 综合生成模式处理异常
- 后端可能不支持 `assessment_ids` 数组参数
- `generation_mode: "comprehensive"` 参数处理有问题
- 多评测综合分析逻辑异常

#### B. 数据库查询异常
- assessment_id 对应的评测记录不存在
- 用户权限验证失败
- 数据库连接超时

#### C. AI服务调用异常
- 音乐生成AI服务不可达
- API密钥过期或无效
- 服务器资源不足（内存/CPU）

#### D. 文件系统异常
- 音频文件存储路径不存在
- 磁盘空间不足
- 文件权限问题

### 6. 修复步骤建议

#### 步骤1：查看详细错误信息
```bash
# 开启详细日志记录
# 在音乐生成接口中添加try-catch和详细日志
try {
    // 音乐生成逻辑
} catch (error) {
    console.error('Music generation error:', {
        error: error.message,
        stack: error.stack,
        requestData: req.body,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
    });
    res.status(500).json({
        error: 'Internal server error',
        details: error.message // 仅在开发环境显示
    });
}
```

#### 步骤2：验证综合生成模式支持
```javascript
// 检查后端是否正确处理综合生成参数
if (req.body.generation_mode === 'comprehensive') {
    const assessmentIds = req.body.assessment_ids;
    if (!Array.isArray(assessmentIds) || assessmentIds.length === 0) {
        return res.status(400).json({
            error: 'Invalid assessment_ids for comprehensive mode'
        });
    }
    // 验证所有评测ID是否存在
    const assessments = await Assessment.findAll({
        where: { id: assessmentIds }
    });
    if (assessments.length !== assessmentIds.length) {
        return res.status(400).json({
            error: 'Some assessment IDs not found'
        });
    }
}
```

#### 步骤3：检查资源和依赖
```bash
# 检查服务器资源
free -h  # 内存使用情况
df -h    # 磁盘空间
top      # CPU使用情况

# 检查依赖服务状态
systemctl status redis    # 如果使用Redis
systemctl status mysql    # 数据库服务
systemctl status nginx    # Web服务器
```

#### 步骤4：添加健康检查端点
```javascript
// 添加健康检查接口
app.get('/api/health/music-generate', async (req, res) => {
    try {
        // 检查数据库连接
        await db.query('SELECT 1');
        
        // 检查AI服务连接
        // await checkAIService();
        
        // 检查文件系统
        // await fs.access(audioStoragePath);
        
        res.json({ 
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});
```

### 7. 临时解决方案

如果问题复杂需要时间修复，可以考虑：

1. **降级到单一生成模式**
```javascript
// 后端临时处理：将综合生成降级为单一生成
if (req.body.generation_mode === 'comprehensive') {
    console.log('Temporarily downgrade comprehensive to single mode');
    // 只使用第一个评测ID
    req.body.assessment_id = req.body.assessment_ids[0];
    delete req.body.assessment_ids;
    delete req.body.generation_mode;
}
```

2. **增加错误重试间隔**
```javascript
// 小程序端：增加重试间隔，减少服务器压力
// 在 networkManager.js 中调整重试逻辑
const retryDelays = [2000, 5000, 10000]; // 2秒、5秒、10秒
```

### 8. 测试验证

#### 使用curl测试后端接口：
```bash
# 测试综合生成模式（当前失败的请求）
curl -X POST https://medsleep.cn/api/music/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{
    "assessment_id": 123,
    "assessment_ids": [123, 456],
    "generation_mode": "comprehensive",
    "scene_context": {}
  }'

# 测试单一生成模式（作为对比）
curl -X POST https://medsleep.cn/api/music/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{
    "assessment_id": 123
  }'
```

## 总结

这是典型的后端500错误，小程序端的实现是正确的。问题很可能出现在：

1. **综合生成模式的后端实现**（最可能）
2. **数据库查询或AI服务调用异常**
3. **服务器资源不足**

建议优先检查服务器日志，确定具体的错误原因，然后针对性修复。

**修复优先级：**
1. 🔥 查看详细的500错误日志
2. 🔥 验证综合生成模式的后端支持
3. ⚠️ 检查数据库和AI服务连通性
4. ⚠️ 验证服务器资源状况

**预计修复时间：** 1-4小时（取决于具体问题复杂度）
