/**
 * 音频缓存管理器 - 智能缓存音频文件
 * 支持服务器同步协调
 */

class AudioCacheManager {
  constructor() {
    this.cacheKey = 'audio_cache_info'
    this.maxCacheSize = 100 * 1024 * 1024 // 100MB
    this.maxCacheFiles = 50 // 最多缓存50个文件
    this.cacheExpireTime = 7 * 24 * 60 * 60 * 1000 // 7天过期
    
    // 同步配置
    this.syncEnabled = true
    this.syncInterval = 5 * 60 * 1000 // 5分钟同步一次
    this.lastSyncTime = 0
    this.syncInProgress = false
    
    // 统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      syncs: 0,
      lastSyncTime: 0
    }
    
    this.init()
  }
  
  /**
   * 初始化缓存管理器
   */
  init() {
    this.cleanExpiredCache()
    this.checkCacheSize()
    
    // 启动定期同步
    if (this.syncEnabled) {
      this.startPeriodicSync()
    }
  }
  
  /**
   * 启动定期同步
   */
  startPeriodicSync() {
    // 每5分钟检查一次是否需要同步
    setInterval(() => {
      this.checkAndSync()
    }, this.syncInterval)
  }
  
  /**
   * 检查并执行同步
   */
  async checkAndSync() {
    const now = Date.now()
    
    // 如果距离上次同步时间超过间隔，且当前没有同步正在进行
    if ((now - this.lastSyncTime) > this.syncInterval && !this.syncInProgress) {
      await this.syncWithServer()
    }
  }
  
  /**
   * 获取缓存信息
   */
  getCacheInfo() {
    try {
      const cacheInfo = wx.getStorageSync(this.cacheKey)
      return cacheInfo || {
        files: {},
        totalSize: 0,
        lastCleanTime: Date.now()
      }
    } catch (error) {
      console.error('获取缓存信息失败:', error)
      return {
        files: {},
        totalSize: 0,
        lastCleanTime: Date.now()
      }
    }
  }
  
  /**
   * 保存缓存信息
   */
  saveCacheInfo(cacheInfo) {
    try {
      wx.setStorageSync(this.cacheKey, cacheInfo)
    } catch (error) {
      console.error('保存缓存信息失败:', error)
    }
  }
  
  /**
   * 生成缓存文件路径
   */
  generateCacheFilePath(url) {
    // 使用URL的hash作为文件名
    const hash = this.simpleHash(url)
    const extension = this.getFileExtension(url) || 'mp3'
    return `${wx.env.USER_DATA_PATH}/audio_cache_${hash}.${extension}`
  }
  
  /**
   * 简单hash函数
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }
  
  /**
   * 获取文件扩展名
   */
  getFileExtension(url) {
    const match = url.match(/\.([^.?]+)(\?|$)/)
    return match ? match[1] : null
  }
  
  /**
   * 检查文件是否已缓存
   */
  async isCached(url) {
    const cacheInfo = this.getCacheInfo()
    const cacheFilePath = this.generateCacheFilePath(url)
    
    if (!cacheInfo.files[url]) {
      return false
    }
    
    // 检查文件是否真实存在
    try {
      const stats = await this.getFileStats(cacheFilePath)
      return stats !== null
    } catch (error) {
      // 文件不存在，清除缓存记录
      delete cacheInfo.files[url]
      this.saveCacheInfo(cacheInfo)
      return false
    }
  }
  
  /**
   * 获取文件统计信息
   */
  getFileStats(filePath) {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(res),
        fail: () => resolve(null)
      })
    })
  }
  
  /**
   * 缓存音频文件
   */
  async cacheAudio(url, priority = 1) {
    console.log('开始缓存音频:', url)
    
    // 检查是否已缓存
    if (await this.isCached(url)) {
      console.log('音频已缓存:', url)
      return this.getCachedFilePath(url)
    }
    
    try {
      // 下载文件
      const tempFilePath = await this.downloadFile(url)
      
      // 获取文件大小
      const fileStats = await this.getFileStats(tempFilePath)
      if (!fileStats) {
        throw new Error('无法获取文件信息')
      }
      
      // 检查缓存空间
      await this.ensureCacheSpace(fileStats.size)
      
      // 移动到缓存目录
      const cacheFilePath = this.generateCacheFilePath(url)
      await this.moveFile(tempFilePath, cacheFilePath)
      
      // 更新缓存信息
      const cacheInfo = this.getCacheInfo()
      cacheInfo.files[url] = {
        filePath: cacheFilePath,
        size: fileStats.size,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        priority: priority
      }
      cacheInfo.totalSize += fileStats.size
      this.saveCacheInfo(cacheInfo)
      
      console.log('音频缓存成功:', url)
      return cacheFilePath
      
    } catch (error) {
      console.error('缓存音频失败:', error)
      throw error
    }
  }
  
  /**
   * 下载文件
   */
  downloadFile(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error(`下载失败: ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })
  }
  
  /**
   * 移动文件
   */
  moveFile(srcPath, destPath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().copyFile({
        srcPath,
        destPath,
        success: () => {
          // 删除临时文件
          wx.getFileSystemManager().unlink({
            filePath: srcPath,
            success: () => resolve(),
            fail: () => resolve() // 删除失败也不影响主流程
          })
        },
        fail: reject
      })
    })
  }
  
  /**
   * 获取缓存文件路径
   */
  getCachedFilePath(url) {
    const cacheInfo = this.getCacheInfo()
    const fileInfo = cacheInfo.files[url]
    
    if (fileInfo) {
      // 更新访问信息
      fileInfo.lastAccessed = Date.now()
      fileInfo.accessCount = (fileInfo.accessCount || 0) + 1
      this.saveCacheInfo(cacheInfo)
      
      return fileInfo.filePath
    }
    
    return null
  }
  
  /**
   * 确保有足够的缓存空间
   */
  async ensureCacheSpace(requiredSize) {
    const cacheInfo = this.getCacheInfo()
    
    // 检查是否超过最大缓存大小
    while (cacheInfo.totalSize + requiredSize > this.maxCacheSize || 
           Object.keys(cacheInfo.files).length >= this.maxCacheFiles) {
      
      // 找到最少使用的文件
      const lruFile = this.findLRUFile(cacheInfo)
      if (!lruFile) break
      
      await this.removeFromCache(lruFile.url, cacheInfo)
    }
  }
  
  /**
   * 找到最少使用的文件
   */
  findLRUFile(cacheInfo) {
    let lruFile = null
    let oldestAccess = Date.now()
    
    for (const [url, fileInfo] of Object.entries(cacheInfo.files)) {
      // 优先级高的文件不容易被清除
      const adjustedTime = fileInfo.lastAccessed + (fileInfo.priority * 24 * 60 * 60 * 1000)
      
      if (adjustedTime < oldestAccess) {
        oldestAccess = adjustedTime
        lruFile = { url, ...fileInfo }
      }
    }
    
    return lruFile
  }
  
  /**
   * 从缓存中移除文件
   */
  async removeFromCache(url, cacheInfo = null) {
    if (!cacheInfo) {
      cacheInfo = this.getCacheInfo()
    }
    
    const fileInfo = cacheInfo.files[url]
    if (!fileInfo) return
    
    try {
      // 删除文件
      await new Promise((resolve) => {
        wx.getFileSystemManager().unlink({
          filePath: fileInfo.filePath,
          success: resolve,
          fail: resolve // 删除失败也继续
        })
      })
      
      // 更新缓存信息
      cacheInfo.totalSize -= fileInfo.size
      delete cacheInfo.files[url]
      this.saveCacheInfo(cacheInfo)
      
      console.log('已从缓存中移除:', url)
    } catch (error) {
      console.error('移除缓存文件失败:', error)
    }
  }
  
  /**
   * 清理过期缓存
   */
  async cleanExpiredCache() {
    const cacheInfo = this.getCacheInfo()
    const now = Date.now()
    const expiredUrls = []
    
    for (const [url, fileInfo] of Object.entries(cacheInfo.files)) {
      if (now - fileInfo.cachedAt > this.cacheExpireTime) {
        expiredUrls.push(url)
      }
    }
    
    for (const url of expiredUrls) {
      await this.removeFromCache(url, cacheInfo)
    }
    
    if (expiredUrls.length > 0) {
      console.log(`清理了 ${expiredUrls.length} 个过期缓存文件`)
    }
    
    cacheInfo.lastCleanTime = now
    this.saveCacheInfo(cacheInfo)
  }
  
  /**
   * 检查缓存大小
   */
  async checkCacheSize() {
    const cacheInfo = this.getCacheInfo()
    
    // 重新计算实际缓存大小
    let actualSize = 0
    const validFiles = {}
    
    for (const [url, fileInfo] of Object.entries(cacheInfo.files)) {
      try {
        const stats = await this.getFileStats(fileInfo.filePath)
        if (stats) {
          actualSize += stats.size
          validFiles[url] = fileInfo
        }
      } catch (error) {
        console.log('缓存文件不存在，已清除记录:', url)
      }
    }
    
    // 更新缓存信息
    cacheInfo.files = validFiles
    cacheInfo.totalSize = actualSize
    this.saveCacheInfo(cacheInfo)
  }
  
  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const cacheInfo = this.getCacheInfo()
    
    return {
      totalFiles: Object.keys(cacheInfo.files).length,
      totalSize: cacheInfo.totalSize,
      totalSizeMB: (cacheInfo.totalSize / (1024 * 1024)).toFixed(2),
      maxSize: this.maxCacheSize,
      maxSizeMB: (this.maxCacheSize / (1024 * 1024)).toFixed(2),
      usagePercent: ((cacheInfo.totalSize / this.maxCacheSize) * 100).toFixed(1),
      lastCleanTime: new Date(cacheInfo.lastCleanTime).toLocaleString()
    }
  }
  
  /**
   * 清空所有缓存
   */
  async clearAllCache() {
    const cacheInfo = this.getCacheInfo()
    
    for (const url of Object.keys(cacheInfo.files)) {
      await this.removeFromCache(url, cacheInfo)
    }
    
    console.log('所有音频缓存已清空')
  }
  
  /**
   * 预缓存热门音频
   */
  async preloadPopularAudio(audioList) {
    console.log('开始预缓存热门音频')
    
    for (const audio of audioList) {
      try {
        await this.cacheAudio(audio.url, audio.priority || 2)
      } catch (error) {
        console.error('预缓存失败:', audio.url, error)
      }
    }
    
    console.log('热门音频预缓存完成')
  }
  
  /**
   * 与服务器同步缓存
   */
  async syncWithServer() {
    if (this.syncInProgress) {
      console.log('缓存同步已在进行中')
      return
    }
    
    this.syncInProgress = true
    console.log('开始缓存同步')
    
    try {
      // 获取当前缓存信息
      const cacheInfo = this.getCacheInfo()
      const clientCacheInfo = {
        files: cacheInfo.files,
        totalSize: cacheInfo.totalSize,
        lastCleanTime: cacheInfo.lastCleanTime,
        maxSize: this.maxCacheSize,
        maxFiles: this.maxCacheFiles
      }
      
      // 请求同步清单
      const syncManifest = await this.requestSyncManifest(clientCacheInfo)
      
      if (syncManifest) {
        // 执行同步操作
        await this.executeSyncActions(syncManifest)
        
        // 更新统计
        this.stats.syncs++
        this.stats.lastSyncTime = Date.now()
        this.lastSyncTime = Date.now()
        
        console.log('缓存同步完成')
      }
      
    } catch (error) {
      console.error('缓存同步失败:', error)
    } finally {
      this.syncInProgress = false
    }
  }
  
  /**
   * 请求同步清单
   */
  async requestSyncManifest(clientCacheInfo) {
    try {
      const { getApiBaseUrl } = require('./config')
      const AuthService = require('../services/AuthService')
      
      // 添加认证头
      const headers = {
        'Content-Type': 'application/json'
      }
      const authHeaders = await AuthService.addAuthHeader(headers)
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${getApiBaseUrl()}/cache/sync-manifest`,
          method: 'POST',
          data: {
            cache_type: 'audio',
            client_cache_info: clientCacheInfo
          },
          header: authHeaders,
          success: resolve,
          fail: reject
        })
      })
      
      if (response.statusCode === 200 && response.data.success) {
        return response.data.data
      } else {
        console.error('获取同步清单失败:', response.data?.error)
        return null
      }
      
    } catch (error) {
      console.error('请求同步清单失败:', error)
      return null
    }
  }
  
  /**
   * 执行同步操作
   */
  async executeSyncActions(syncManifest) {
    const actions = syncManifest.actions || []
    const recommendations = syncManifest.server_recommendations || []
    
    console.log(`执行 ${actions.length} 个同步操作, ${recommendations.length} 个推荐操作`)
    
    // 执行必要的清理操作
    for (const action of actions) {
      try {
        await this.executeSyncAction(action)
      } catch (error) {
        console.error(`执行同步操作失败:`, action, error)
      }
    }
    
    // 执行推荐操作（优先级高的）
    const highPriorityRecommendations = recommendations.filter(
      rec => rec.priority === 'high'
    )
    
    for (const recommendation of highPriorityRecommendations) {
      try {
        await this.executeSyncAction(recommendation)
      } catch (error) {
        console.error(`执行推荐操作失败:`, recommendation, error)
      }
    }
  }
  
  /**
   * 执行单个同步操作
   */
  async executeSyncAction(action) {
    const fileKey = action.file_key
    
    switch (action.action) {
      case 'remove':
        await this.removeCachedFile(fileKey)
        console.log(`移除缓存文件: ${fileKey} (${action.reason})`)
        break
        
      case 'update':
        // 重新下载文件
        console.log(`更新缓存文件: ${fileKey} (${action.reason})`)
        // 这里可以实现重新下载逻辑
        break
        
      case 'consider_remove':
        // 根据策略决定是否移除
        if (action.priority === 'high' || action.days_since_access > 14) {
          await this.removeCachedFile(fileKey)
          console.log(`清理低使用率文件: ${fileKey}`)
        }
        break
        
      case 'prefetch':
        // 预缓存推荐文件
        console.log(`推荐预缓存: ${fileKey} (${action.reason})`)
        // 这里可以实现预缓存逻辑
        break
        
      default:
        console.warn(`未知的同步操作: ${action.action}`)
    }
  }
  
  /**
   * 移除缓存文件
   */
  async removeCachedFile(fileKey) {
    try {
      const cacheInfo = this.getCacheInfo()
      const fileInfo = cacheInfo.files[fileKey]
      
      if (!fileInfo) {
        return // 文件不存在
      }
      
      const filePath = this.generateCacheFilePath(fileKey)
      
      // 删除物理文件
      try {
        const fileManager = wx.getFileSystemManager()
        fileManager.unlinkSync(filePath)
      } catch (error) {
        // 文件可能已经不存在，忽略错误
      }
      
      // 更新缓存信息
      cacheInfo.totalSize -= (fileInfo.size || 0)
      delete cacheInfo.files[fileKey]
      
      this.saveCacheInfo(cacheInfo)
      
    } catch (error) {
      console.error(`移除缓存文件失败 ${fileKey}:`, error)
    }
  }
  
  /**
   * 验证缓存完整性
   */
  async validateCacheIntegrity() {
    try {
      const { getApiBaseUrl } = require('./config')
      const AuthService = require('../services/AuthService')
      
      const cacheInfo = this.getCacheInfo()
      const headers = await AuthService.addAuthHeader({
        'Content-Type': 'application/json'
      })
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${getApiBaseUrl()}/cache/validate-integrity`,
          method: 'POST',
          data: {
            cache_type: 'audio',
            client_cache_info: {
              files: cacheInfo.files,
              totalSize: cacheInfo.totalSize
            }
          },
          header: headers,
          success: resolve,
          fail: reject
        })
      })
      
      if (response.statusCode === 200 && response.data.success) {
        const validation = response.data.data
        
        if (!validation.is_valid) {
          console.warn('缓存完整性验证失败:', validation.issues)
          
          // 如果建议重建缓存，执行清理
          const shouldRebuild = validation.recommendations.some(
            rec => rec.action === 'rebuild_cache_metadata'
          )
          
          if (shouldRebuild) {
            console.log('重建缓存元数据')
            await this.rebuildCacheMetadata()
          }
        }
        
        return validation
      }
      
    } catch (error) {
      console.error('缓存完整性验证失败:', error)
    }
    
    return null
  }
  
  /**
   * 重建缓存元数据
   */
  async rebuildCacheMetadata() {
    try {
      const cacheInfo = this.getCacheInfo()
      const fileManager = wx.getFileSystemManager()
      
      // 验证每个缓存文件是否真实存在
      for (const [fileKey, fileInfo] of Object.entries(cacheInfo.files)) {
        const filePath = this.generateCacheFilePath(fileKey)
        
        try {
          const stats = fileManager.statSync(filePath)
          // 更新文件大小信息
          if (stats.size !== fileInfo.size) {
            fileInfo.size = stats.size
            console.log(`更新文件大小: ${fileKey}`)
          }
        } catch (error) {
          // 文件不存在，从缓存信息中移除
          console.log(`移除不存在的缓存记录: ${fileKey}`)
          cacheInfo.totalSize -= (fileInfo.size || 0)
          delete cacheInfo.files[fileKey]
        }
      }
      
      // 重新计算总大小
      let totalSize = 0
      for (const fileInfo of Object.values(cacheInfo.files)) {
        totalSize += fileInfo.size || 0
      }
      cacheInfo.totalSize = totalSize
      
      // 保存更新后的缓存信息
      this.saveCacheInfo(cacheInfo)
      
      console.log('缓存元数据重建完成')
      
    } catch (error) {
      console.error('重建缓存元数据失败:', error)
    }
  }
  
  /**
   * 获取缓存统计（包含同步信息）
   */
  getExtendedCacheStats() {
    const basicStats = this.getCacheStats()
    
    return {
      ...basicStats,
      sync: {
        enabled: this.syncEnabled,
        lastSyncTime: this.stats.lastSyncTime,
        syncCount: this.stats.syncs,
        syncInProgress: this.syncInProgress,
        nextSyncIn: this.syncEnabled ? 
          Math.max(0, this.syncInterval - (Date.now() - this.lastSyncTime)) : null
      },
      performance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: this.stats.hits > 0 ? 
          (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%' : '0%'
      }
    }
  }
}

// 创建全局实例
const audioCacheManager = new AudioCacheManager()

module.exports = audioCacheManager
