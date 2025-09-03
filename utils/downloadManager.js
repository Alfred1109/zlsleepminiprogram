// utils/downloadManager.js
/**
 * 下载管理器
 * 负责管理音频文件的下载、存储和播放
 */

const AuthService = require('../services/AuthService')

class DownloadManager {
  constructor() {
    this.storageKey = 'userDownloads'
    this.downloadTasks = new Map() // 存储正在进行的下载任务
    this.maxConcurrentDownloads = 3 // 最大并发下载数
    this.downloadQueue = [] // 下载队列
  }

  /**
   * 获取所有下载项目
   */
  getAllDownloads() {
    try {
      return wx.getStorageSync(this.storageKey) || []
    } catch (error) {
      console.error('获取下载列表失败:', error)
      return []
    }
  }

  /**
   * 检查是否已下载
   */
  isDownloaded(itemId) {
    const downloads = this.getAllDownloads()
    return downloads.some(item => item.id === itemId && item.status === 'downloaded')
  }

  /**
   * 获取下载项目
   */
  getDownloadItem(itemId) {
    const downloads = this.getAllDownloads()
    return downloads.find(item => item.id === itemId)
  }

  /**
   * 开始下载
   */
  async startDownload(item, options = {}) {
    try {
      if (!AuthService.isLoggedIn()) {
        throw new Error('需要登录才能下载')
      }

      // 检查是否已经在下载或已下载
      const existingItem = this.getDownloadItem(item.id)
      if (existingItem) {
        if (existingItem.status === 'downloaded') {
          throw new Error('文件已下载')
        }
        if (existingItem.status === 'downloading') {
          throw new Error('文件正在下载中')
        }
      }

      // 创建下载项目
      const downloadItem = {
        id: item.id,
        title: item.title || item.name || '未知标题',
        subtitle: item.subtitle || item.category || '',
        cover: item.cover || item.coverUrl || item.image || '/images/default-music-cover.svg',
        fileSize: item.fileSize || 0,
        duration: item.duration || 0,
        status: 'downloading',
        progress: 0,
        downloadTime: Date.now(),
        localPath: '',
        url: item.url || item.downloadUrl,
        fileType: item.fileType || 'audio',
        metadata: {
          category: item.category,
          quality: options.quality || 'standard',
          ...item.metadata
        },
        originalData: item
      }

      // 更新下载列表
      this.updateDownloadItem(downloadItem)

      // 检查并发下载限制
      if (this.downloadTasks.size >= this.maxConcurrentDownloads) {
        this.downloadQueue.push(downloadItem)
        wx.showToast({
          title: '已加入下载队列',
          icon: 'none'
        })
        return downloadItem
      }

      // 开始实际下载
      this.performDownload(downloadItem)

      return downloadItem
    } catch (error) {
      console.error('开始下载失败:', error)
      throw error
    }
  }

  /**
   * 执行下载
   */
  performDownload(downloadItem) {
    return new Promise((resolve, reject) => {
      // 使用微信小程序的下载API
      const downloadTask = wx.downloadFile({
        url: downloadItem.url,
        success: (res) => {
          if (res.statusCode === 200) {
            // 下载成功，移动到本地存储
            this.saveToLocal(downloadItem, res.tempFilePath)
              .then(() => {
                downloadItem.status = 'downloaded'
                downloadItem.progress = 100
                downloadItem.localPath = this.getLocalPath(downloadItem.id)
                this.updateDownloadItem(downloadItem)
                this.downloadTasks.delete(downloadItem.id)
                this.processQueue()
                resolve(downloadItem)
              })
              .catch((error) => {
                downloadItem.status = 'failed'
                downloadItem.error = error.message
                this.updateDownloadItem(downloadItem)
                this.downloadTasks.delete(downloadItem.id)
                this.processQueue()
                reject(error)
              })
          } else {
            downloadItem.status = 'failed'
            downloadItem.error = `下载失败，状态码: ${res.statusCode}`
            this.updateDownloadItem(downloadItem)
            this.downloadTasks.delete(downloadItem.id)
            this.processQueue()
            reject(new Error(downloadItem.error))
          }
        },
        fail: (error) => {
          downloadItem.status = 'failed'
          downloadItem.error = error.errMsg || '下载失败'
          this.updateDownloadItem(downloadItem)
          this.downloadTasks.delete(downloadItem.id)
          this.processQueue()
          reject(error)
        }
      })

      // 监听下载进度
      downloadTask.onProgressUpdate((res) => {
        downloadItem.progress = res.progress
        downloadItem.totalBytesWritten = res.totalBytesWritten
        downloadItem.totalBytesExpectedToWrite = res.totalBytesExpectedToWrite
        
        // 估算文件大小
        if (!downloadItem.fileSize && res.totalBytesExpectedToWrite) {
          downloadItem.fileSize = res.totalBytesExpectedToWrite / (1024 * 1024) // 转换为MB
        }
        
        this.updateDownloadItem(downloadItem)
      })

      // 存储下载任务
      this.downloadTasks.set(downloadItem.id, {
        task: downloadTask,
        item: downloadItem,
        resolve,
        reject
      })
    })
  }

  /**
   * 保存到本地存储
   */
  async saveToLocal(downloadItem, tempFilePath) {
    try {
      const localPath = this.getLocalPath(downloadItem.id)
      
      // 使用文件系统管理器
      const fs = wx.getFileSystemManager()
      
      // 创建本地文件
      return new Promise((resolve, reject) => {
        fs.saveFile({
          tempFilePath: tempFilePath,
          filePath: localPath,
          success: () => {
            console.log('文件保存成功:', localPath)
            resolve(localPath)
          },
          fail: (error) => {
            console.error('文件保存失败:', error)
            reject(new Error('文件保存失败'))
          }
        })
      })
    } catch (error) {
      console.error('保存文件到本地失败:', error)
      throw error
    }
  }

  /**
   * 获取本地文件路径
   */
  getLocalPath(itemId) {
    return `${wx.env.USER_DATA_PATH}/downloads/${itemId}.mp3`
  }

  /**
   * 取消下载
   */
  cancelDownload(itemId) {
    const task = this.downloadTasks.get(itemId)
    if (task) {
      task.task.abort()
      this.downloadTasks.delete(itemId)
      
      // 更新状态
      const downloadItem = task.item
      downloadItem.status = 'failed'
      downloadItem.error = '用户取消下载'
      this.updateDownloadItem(downloadItem)
      
      // 处理队列
      this.processQueue()
      
      return true
    }
    return false
  }

  /**
   * 重新下载
   */
  async retryDownload(itemId) {
    const downloadItem = this.getDownloadItem(itemId)
    if (!downloadItem) {
      throw new Error('未找到下载项目')
    }

    // 重置状态
    downloadItem.status = 'downloading'
    downloadItem.progress = 0
    downloadItem.error = ''
    downloadItem.downloadTime = Date.now()
    this.updateDownloadItem(downloadItem)

    // 重新开始下载
    return this.performDownload(downloadItem)
  }

  /**
   * 删除下载
   */
  async deleteDownload(itemId) {
    try {
      // 取消正在进行的下载
      this.cancelDownload(itemId)

      // 删除本地文件
      const downloadItem = this.getDownloadItem(itemId)
      if (downloadItem && downloadItem.localPath) {
        await this.deleteLocalFile(downloadItem.localPath)
      }

      // 从下载列表中移除
      const downloads = this.getAllDownloads()
      const filteredDownloads = downloads.filter(item => item.id !== itemId)
      wx.setStorageSync(this.storageKey, filteredDownloads)

      return true
    } catch (error) {
      console.error('删除下载失败:', error)
      throw error
    }
  }

  /**
   * 删除本地文件
   */
  deleteLocalFile(filePath) {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.unlink({
        filePath: filePath,
        success: () => {
          console.log('本地文件删除成功:', filePath)
          resolve()
        },
        fail: (error) => {
          console.warn('删除本地文件失败:', error)
          resolve() // 不抛出错误，避免影响主流程
        }
      })
    })
  }

  /**
   * 更新下载项目
   */
  updateDownloadItem(downloadItem) {
    const downloads = this.getAllDownloads()
    const index = downloads.findIndex(item => item.id === downloadItem.id)
    
    if (index >= 0) {
      downloads[index] = { ...downloads[index], ...downloadItem }
    } else {
      downloads.unshift(downloadItem)
    }
    
    wx.setStorageSync(this.storageKey, downloads)
  }

  /**
   * 处理下载队列
   */
  processQueue() {
    if (this.downloadQueue.length > 0 && this.downloadTasks.size < this.maxConcurrentDownloads) {
      const nextDownload = this.downloadQueue.shift()
      this.performDownload(nextDownload)
    }
  }

  /**
   * 获取下载统计
   */
  getStats() {
    const downloads = this.getAllDownloads()
    const totalSize = downloads.reduce((total, item) => {
      return total + (item.fileSize || 0)
    }, 0)
    
    return {
      total: downloads.length,
      downloaded: downloads.filter(item => item.status === 'downloaded').length,
      downloading: downloads.filter(item => item.status === 'downloading').length,
      failed: downloads.filter(item => item.status === 'failed').length,
      totalSize: totalSize, // MB
      queueLength: this.downloadQueue.length
    }
  }

  /**
   * 清理失败的下载
   */
  async clearFailedDownloads() {
    try {
      const downloads = this.getAllDownloads()
      const successfulDownloads = downloads.filter(item => item.status !== 'failed')
      wx.setStorageSync(this.storageKey, successfulDownloads)
      return downloads.length - successfulDownloads.length
    } catch (error) {
      console.error('清理失败下载失败:', error)
      throw error
    }
  }

  /**
   * 清理所有下载
   */
  async clearAllDownloads() {
    try {
      if (!AuthService.isLoggedIn()) {
        throw new Error('需要登录才能操作下载')
      }

      // 取消所有正在进行的下载
      for (const [itemId] of this.downloadTasks) {
        this.cancelDownload(itemId)
      }

      // 删除所有本地文件
      const downloads = this.getAllDownloads()
      for (const download of downloads) {
        if (download.localPath) {
          await this.deleteLocalFile(download.localPath)
        }
      }

      // 清空下载列表
      wx.removeStorageSync(this.storageKey)
      this.downloadQueue = []

      return true
    } catch (error) {
      console.error('清空所有下载失败:', error)
      throw error
    }
  }

  /**
   * 检查本地文件是否存在
   */
  checkLocalFileExists(filePath) {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.access({
        path: filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })
  }

  /**
   * 获取本地文件信息
   */
  getLocalFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager()
      fs.stat({
        path: filePath,
        success: (res) => resolve(res),
        fail: (error) => reject(error)
      })
    })
  }

  /**
   * 验证下载完整性
   */
  async validateDownloads() {
    const downloads = this.getAllDownloads()
    const results = []
    
    for (const download of downloads) {
      if (download.status === 'downloaded' && download.localPath) {
        const exists = await this.checkLocalFileExists(download.localPath)
        if (!exists) {
          // 文件不存在，更新状态为失败
          download.status = 'failed'
          download.error = '本地文件丢失'
          this.updateDownloadItem(download)
        }
        results.push({ id: download.id, exists })
      }
    }
    
    return results
  }

  /**
   * 获取存储使用情况
   */
  async getStorageUsage() {
    try {
      const downloads = this.getAllDownloads()
      let totalSize = 0
      let fileCount = 0
      
      for (const download of downloads) {
        if (download.status === 'downloaded' && download.localPath) {
          const exists = await this.checkLocalFileExists(download.localPath)
          if (exists) {
            try {
              const fileInfo = await this.getLocalFileInfo(download.localPath)
              totalSize += fileInfo.size || 0
              fileCount++
            } catch (error) {
              console.warn('获取文件信息失败:', download.localPath)
            }
          }
        }
      }
      
      return {
        totalSize: totalSize / (1024 * 1024), // 转换为MB
        fileCount: fileCount,
        downloads: downloads.length
      }
    } catch (error) {
      console.error('获取存储使用情况失败:', error)
      return { totalSize: 0, fileCount: 0, downloads: 0 }
    }
  }
}

// 导出单例实例
const downloadManager = new DownloadManager()

module.exports = {
  downloadManager,
  DownloadManager
}
