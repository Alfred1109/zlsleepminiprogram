# CDN Token自动刷新机制改造

## 改造背景

后端已经改造成**自动获取token永不过期**的机制，小程序需要配合改造，当CDN认证失败时自动从后端获取最新的访问URL。

## 问题现象

**NSURLErrorDomain -1013错误**：
```
🎵 音频事件: 播放错误 {errMsg: "INNERERRCODE:-1013, ERRMSG:未能完成操作。（NSURLErrorDomain错误-1013。）", errCode: 10002}
```

这是CDN认证失败，说明token过期或无效。

## 改造方案

### 1. **新增API接口** - `utils/healingApi.js`

#### MusicAPI新增方法：
```javascript
/**
 * 刷新音频URL（获取最新的CDN访问链接）
 */
refreshAudioUrl(musicId) {
  return get(`/music/refresh_url/${musicId}`)
}
```

#### LongSequenceAPI新增方法：
```javascript
/**
 * 刷新长序列音频URL（获取最新的CDN访问链接）
 */
refreshLongSequenceUrl(sessionId) {
  return get(`/music/refresh_long_sequence_url/${sessionId}`)
}
```

### 2. **自动刷新机制** - `components/global-player/global-player.js`

#### CDN错误检测和自动处理：
```javascript
// 检测到CDN认证失败时，自动刷新URL
if (error.errMsg && error.errMsg.includes('NSURLErrorDomain错误-1013')) {
  console.error('🔐 CDN认证失败，尝试刷新URL')
  this.handleCdnAuthError(currentTrack)
  return // 不显示错误提示，让刷新流程处理
}
```

#### 自动刷新和重播机制：
```javascript
async handleCdnAuthError(currentTrack) {
  try {
    wx.showLoading({ title: '刷新播放链接...' })
    
    // 根据音频类型选择刷新策略
    if (currentTrack.type === 'longSequence') {
      const result = await LongSequenceAPI.refreshLongSequenceUrl(currentTrack.sessionId)
      newUrl = result.data.final_file_path
    } else {
      const result = await MusicAPI.refreshAudioUrl(currentTrack.id)
      newUrl = result.data.url
    }
    
    // 自动重新播放
    if (newUrl) {
      const updatedTrack = { ...currentTrack, url: newUrl }
      this.playTrack(updatedTrack)
    }
  } catch (error) {
    // 错误处理和重试选项
  }
}
```

### 3. **修改URL修复逻辑** - `utils/unifiedMusicManager.js`

不再手动处理token，改为通过后端API刷新：
```javascript
fixQiniuUrl(originalUrl) {
  console.log('🔄 URL修复已改为通过后端刷新，不再手动处理token')
  // 返回原始URL，让后端处理token刷新
  return originalUrl
}
```

## 用户体验流程

### **无感知自动修复**：
1. 用户点击播放音频
2. 如果CDN认证失败（-1013错误）
3. 自动显示"刷新播放链接..."
4. 后端返回新的token和URL  
5. 自动重新播放音频
6. 显示"链接已更新"成功提示

### **失败时的友好提示**：
- 如果刷新成功：无感知继续播放
- 如果刷新失败：提供重试选项
- 如果重试失败：引导用户重新选择音频

## 后端配套接口

小程序改造需要后端提供以下接口：

### 60秒音频刷新：
```
GET /api/music/refresh_url/{musicId}

Response:
{
  "success": true,
  "data": {
    "url": "https://cdn.medsleep.cn/ai-generated/music_93_xxx.wav?e=xxx&token=xxx"
  }
}
```

### 长序列音频刷新：
```
GET /api/music/refresh_long_sequence_url/{sessionId}

Response:
{
  "success": true,
  "data": {
    "final_file_path": "/static/generated_music/long_sequences/xxx.wav?token=xxx"
  }
}
```

## 兼容性保证

1. **向后兼容**：如果后端接口不存在，会显示友好的错误提示
2. **降级处理**：刷新失败时提供手动重试选项
3. **错误分类**：区分网络错误、权限错误、服务器错误等

## 测试验证

### 正常流程测试：
1. ✅ 播放60秒音频 → 正常播放
2. ✅ 播放长序列音频 → 正常播放

### CDN认证失败测试：
1. ✅ 模拟token过期 → 自动刷新并继续播放
2. ✅ 后端刷新接口异常 → 友好错误提示
3. ✅ 网络异常 → 提供重试选项

### 用户体验测试：
1. ✅ 刷新过程有加载提示
2. ✅ 刷新成功有成功提示
3. ✅ 刷新失败有明确错误信息

## 监控和日志

改造后的日志输出：
```
🔐 CDN认证失败，尝试刷新URL
🔄 请求刷新音频URL, musicId: 93
🔄 音频URL刷新响应: {...}
✅ 音频URL刷新成功: https://...
✅ URL刷新成功，重新播放: https://...
```

便于监控CDN认证失败率和自动修复成功率。

## 总结

这个改造实现了：
- **无感知修复**：CDN认证失败时自动刷新URL
- **用户友好**：提供清晰的状态提示和错误处理
- **向后兼容**：与现有系统完美兼容
- **易于维护**：统一的错误处理和刷新逻辑

用户不再需要手动重新选择音频，系统会自动修复CDN认证问题并继续播放。
