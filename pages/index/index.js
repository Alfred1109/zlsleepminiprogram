// pages/index/index.js
const app = getApp()
const util = require('../../utils/util.js')
const { unifiedMusicManager } = require('../../utils/unifiedMusicManager')
const AuthService = require('../../services/AuthService')
const { getCurrentConfig } = require('../../utils/config')
const { MusicAPI, LongSequenceAPI } = require('../../utils/healingApi')
const { getUnifiedSubscriptionStatus } = require('../../utils/subscription')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    selectedCategory: 1,
    sounds: [],
    
    categories: [],
    
    // 订阅状态相关
    subscriptionStatus: null,
    unifiedStatus: null,
    
    // 全局播放器相关
    showGlobalPlayer: false,
    isLoading: false,

  },
  
  onLoad: function () {
    console.log('Index page loaded')
    
    // 清除可能的缓存，确保分类数据是最新的
    wx.removeStorageSync('music_categories_cache')
    
    // 延迟检查登录状态，确保App实例已初始化
    setTimeout(() => {
      try {
        // 检查登录状态（不强制登录，允许未登录用户浏览首页）
        this.checkLoginStatus();
      } catch (error) {
        console.error('登录检查失败:', error);
        // 如果登录检查失败，继续初始化页面但标记为未登录状态
        this.setData({
          isLoggedIn: false,
          userInfo: null
        });
      }
    }, 100);

    this.initData();
    
    // 统一使用音乐管理器来处理分类数据（移除重复的数据源）
    this.initUnifiedMusicManager();
    

    // 获取App实例
    this.app = getApp();
    
    // 初始化全局播放器
    this.initGlobalPlayer();

    // 导入七牛云统一管理器
    const { qiniuManagerUnified } = require('../../utils/qiniuManagerUnified');
    this.qiniuManager = qiniuManagerUnified;

  },
  
  onShow: function() {
    // 延迟检查登录状态，避免App实例未初始化的问题
    setTimeout(() => {
      try {
        // 检查登录状态
        this.checkLoginStatus();
        
      } catch (error) {
        console.error('检查登录状态失败:', error);
        // 如果检查失败，设置默认状态
        this.setData({
          isLoggedIn: false,
          userInfo: null
        });
      }
    }, 50);

    // 旧波形动画代码已移除，现在使用实时脑波组件
  },
  
  onHide: function() {
    // 旧波形动画代码已移除，现在使用实时脑波组件
  },
  
  onUnload: function() {
    // 页面卸载时，停止所有音频
    this.stopAllAudio();
  },

  /**
   * 将分类ID映射为后端分类代码（与推荐引擎保持一致）
   */
  getCategoryCode(id) {
    // 优先取服务端返回的分类code，静态映射仅作兜底
    const cat = (this.data.categories || []).find(c => c.id === id)
    if (cat && (cat.code || cat.scale_type || cat.type)) {
      return cat.code || cat.scale_type || cat.type
    }
    
    // 🔧 修复：使用与服务器返回数据一致的ID映射逻辑
    const idToCode = {
      1: 'natural_sound',
      2: 'white_noise',
      3: 'brainwave', 
      4: 'ai_music',
      5: 'healing_resource'  // 🚨 修复：使用服务器实际返回的代码
    }
    
    const mappedCode = idToCode[id] || 'healing_resource'
    return mappedCode
  },

  /**
   * 从源头获取该分类的实际音频数
   */
  async getActualCategoryCount(categoryId, writeBack = true) {
    try {
      const { MusicAPI } = require('../../utils/healingApi')
      const code = this.getCategoryCode(categoryId)
      if (!code) return 0
      const res = await MusicAPI.getQiniuFilesByCategory(code).catch(() => ({ success: false }))
      const count = res && res.success && res.data && Array.isArray(res.data.files) ? res.data.files.length : 0
      if (writeBack && count >= 0 && Array.isArray(this.data.categories) && this.data.categories.length) {
        const updated = this.data.categories.map(c => c.id === categoryId ? { ...c, count } : c)
        this.setData({ categories: updated })
      }
      return count
    } catch (_) {
      return 0
    }
  },





  // --- 新增：引导功能区事件处理 ---






  
  /**
   * 初始化统一音乐管理器（添加调试信息）
   */
  initUnifiedMusicManager: function() {
    // 显示加载提示
    this.setData({ isLoading: true })
    
    // 移除详细调试输出
    
    // 移除测试网络连接调用，避免阻塞初始化
    
    unifiedMusicManager.init().then((success) => {
      if (success) {
        // 获取最新的分类数据，过滤掉冥想疗愈分类（AI生成音频，单独收费）
        const allCategories = unifiedMusicManager.getAllCategories()
        try {
          const longSeqIds = this.detectLongSequenceCategoryIds(allCategories)
          if (longSeqIds.length > 0) {
            console.log('[首页] 检测到长序列相关分类ID:', longSeqIds.join(', '))
          }
        } catch (e) {
          console.warn('[首页] 长序列分类检测失败:', e)
        }
        const categories = this.filterCategories(allCategories)
        
        this.setData({
          categories: categories,
          isLoading: false
        })
        
        // 显示成功获取的提示
        wx.showToast({
          title: `已获取${categories.length}个分类`,
          icon: 'success',
          duration: 2000
        })
        
        // 直接使用数据库返回的计数，不做修正
        console.log('[首页] 分类计数:', categories.map(c => `${c.name}:${c.count}`).join(', '))
        
      } else {
        this.handleInitFailure('初始化失败')
      }
    }).catch((error) => {
      console.error('初始化统一音乐管理器异常:', error)
      this.handleInitFailure(`初始化异常: ${error.message}`)
    })
  },

  /**
   * 处理初始化失败的情况
   */
  handleInitFailure: function(reason) {
    // 处理初始化失败
    
    this.setData({
      categories: this.getDefaultCategories(),
      isLoading: false
    })
    
    // 显示失败信息，让用户知道正在使用默认分类
    wx.showModal({
      title: '分类数据获取失败',
      content: `${reason}，当前显示的是默认分类数据。请检查网络连接后点击刷新按钮重试。`,
      confirmText: '立即重试',
      cancelText: '稍后再试',
      success: (res) => {
        if (res.confirm) {
          this.onManualRefreshCategories()
        }
      }
    })
    
    this.loadFallbackRecommendations();
  },

  // 缓存检测逻辑已移除 - 现在直接从服务器获取最新数据

  /**
   * 通过统一管理器强制刷新分类数据
   */
  forceRefreshCategoriesFromManager: function() {
    // 通过统一管理器强制刷新分类数据
    
    // 显示加载提示
    wx.showLoading({
      title: '正在获取最新分类数据...',
      mask: true
    })
    
    // 使用统一管理器的强制刷新方法（绕过所有缓存）
    unifiedMusicManager.forceRefreshFromServer().then((result) => {
      wx.hideLoading()
      
      if (result && result.success) {
        const allCategories = result.data || unifiedMusicManager.getAllCategories()
        // 过滤掉冥想疗愈分类（AI生成音频，单独收费）
        try {
          const longSeqIds = this.detectLongSequenceCategoryIds(allCategories)
          if (longSeqIds.length > 0) {
            console.log('[首页-刷新] 检测到长序列相关分类ID:', longSeqIds.join(', '))
          }
        } catch (e) {
          console.warn('[首页-刷新] 长序列分类检测失败:', e)
        }
        const categories = this.filterCategories(allCategories)
        
        this.setData({
          categories: categories,
          isLoading: false
        })
        
        // 分类数据刷新成功
        
        // 刷新时间记录已移除
        
        // 显示刷新成功提示
        wx.showToast({
          title: '分类数据已更新',
          icon: 'success',
          duration: 2000
        })
        
      } else {
        // 降级处理
        console.warn('强制刷新也失败，使用默认分类')
        this.handleRefreshFailure()
      }
    }).catch((error) => {
      wx.hideLoading()
      console.error('强制刷新分类失败:', error)
      this.handleRefreshFailure()
    })
  },

  // 缓存清理方法已移除

  /**
   * 处理刷新失败的情况
   */
  handleRefreshFailure: function() {
    this.setData({
      categories: this.getDefaultCategories(),
      isLoading: false
    })
    
    wx.showModal({
      title: '获取分类数据失败',
      content: '无法从服务器获取最新的分类数据，已使用默认分类。请检查网络连接或稍后重试。',
      confirmText: '重试',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          // 用户选择重试
          setTimeout(() => {
            this.forceRefreshCategoriesFromManager()
          }, 1000)
        }
      }
    })
    
    this.loadFallbackRecommendations();
  },



  /**
   * 检查登录状态（不强制跳转）
   */
  checkLoginStatus: function() {
    try {
      const userInfo = AuthService.getCurrentUser();
      const loggedIn = !!userInfo;

      // 更新页面数据
      this.setData({
        isLoggedIn: loggedIn,
        userInfo: userInfo
      });

      // 如果已登录，加载订阅状态
      if (loggedIn) {
        this.loadSubscriptionStatus();
      } else {
        // 未登录时清空订阅状态
        this.setData({
          subscriptionStatus: null,
          unifiedStatus: null
        });
      }

      return loggedIn;
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 发生错误时，设置为未登录状态
      this.setData({
        isLoggedIn: false,
        userInfo: null,
        subscriptionStatus: null,
        unifiedStatus: null
      });
      return false;
    }
  },

  /**
   * 跳转到登录页面
   */
  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/index/index')
    });
  },

  /**
   * 加载订阅状态
   */
  async loadSubscriptionStatus() {
    if (!this.data.isLoggedIn) {
      return;
    }

    try {
      console.log('🔍 首页加载订阅状态...');
      
      // 使用统一的订阅状态获取方法
      const unifiedStatus = await getUnifiedSubscriptionStatus();
      
      // 根据统一状态构建显示状态
      let subscriptionStatus = {
        type: unifiedStatus.type,
        displayName: unifiedStatus.displayName,
        showUpgrade: !unifiedStatus.isSubscribed,
        statusColor: '#999',
        statusIcon: '👤',
        description: ''
      };

      // 根据订阅类型设置详细信息
      if (unifiedStatus.isSubscribed) {
        if (unifiedStatus.type === 'premium') {
          subscriptionStatus.statusColor = '#10b981';
          subscriptionStatus.statusIcon = '💎';
          subscriptionStatus.description = '畅享所有高级功能';
        } else if (unifiedStatus.type === 'vip') {
          subscriptionStatus.statusColor = '#8b5cf6';
          subscriptionStatus.statusIcon = '👑';
          subscriptionStatus.description = '专享VIP特权';
        }
        subscriptionStatus.showUpgrade = false;
      } else if (unifiedStatus.isInTrial) {
        subscriptionStatus.statusColor = '#f59e0b';
        subscriptionStatus.statusIcon = '⭐';
        subscriptionStatus.description = `试用期剩余${unifiedStatus.trialDaysLeft}天`;
        subscriptionStatus.showUpgrade = false;
      } else {
        subscriptionStatus.description = '升级解锁更多功能';
      }

      console.log('🔍 首页订阅状态加载完成:', {
        '统一状态': unifiedStatus,
        '显示状态': subscriptionStatus
      });

      this.setData({
        subscriptionStatus,
        unifiedStatus
      });

    } catch (error) {
      console.error('首页加载订阅状态失败:', error);
    }
  },

  /**
   * 跳转到订阅页面
   */
  goToSubscription: function() {
    wx.navigateTo({
      url: '/pages/subscription/subscription'
    });
  },

  initData: function () {
    // 初始化界面状态
    this.setData({
      sounds: []
    });
  },
  
  // 旧的波形方法已删除，现在使用 brainwave-realtime 组件
  
  // 设备绑定功能已移至设备管理页面
  // checkDeviceBindStatus: function() {
  //   // 确保btManager已初始化
  //   if (!this.btManager) {
  //     this.btManager = bluetoothManager.getBluetoothManager();
  //   }
  //   const that = this;
  //   this.btManager.getAllowedConnectedDevices().then(devices => {
  //     if (devices && devices.length > 0) {
  //       that.setData({
  //         hasBindDevice: true,
  //         deviceInfo: {
  //           name: devices[0].name || devices[0].localName || '未知设备',
  //           status: '已连接'
  //         }
  //       });
  //     } else {
  //       that.setData({
  //         hasBindDevice: false,
  //         deviceInfo: { name: '', status: '' }
  //       });
  //     }
  //   }).catch(() => {
  //     that.setData({
  //       hasBindDevice: false,
  //       deviceInfo: { name: '', status: '' }
  //     });
  //   });
  // },
  
  // 设备绑定功能已移至设备管理页面
  // bindDevice: function() {
  //   // 确保btManager已初始化
  //   if (!this.btManager) {
  //     this.btManager = bluetoothManager.getBluetoothManager();
  //   }
  //   const that = this;
  //   wx.openBluetoothAdapter({
  //     success() {
  //       that.btManager.getAllowedConnectedDevices().then(devices => {
  //         if (devices && devices.length > 0) {
  //           that.setData({
  //             hasBindDevice: true,
  //             deviceInfo: {
  //               name: devices[0].name || devices[0].localName || '未知设备',
  //               status: '已连接'
  //             },
  //             selectedBluetoothDeviceId: devices[0].deviceId
  //           });
  //           wx.showToast({ title: '已绑定蓝牙设备', icon: 'success' });
  //         } else {
  //           wx.showToast({ title: '请先连接允许的蓝牙设备', icon: 'none' });
  //         }
  //       }).catch(() => {
  //         wx.showToast({ title: '蓝牙状态异常', icon: 'none' });
  //       });
  //     },
  //     fail() {
  //       wx.showToast({ title: '请先打开手机蓝牙', icon: 'none' });
  //     }
  //   });
  // },
  
  // 设备控制功能已移至设备管理页面
  // controlDevice: function() {
  //   wx.navigateTo({
  //     url: '/pages/device/control/control'
  //   });
  // },
  
  // 移除心情和脑波选择逻辑，现在直接基于音乐实时生成波形
  
  selectDuration: function(e) {
    const duration = parseInt(e.currentTarget.dataset.duration);
    
    this.setData({
      selectedDuration: duration
    });
  },
  
  // 移除脑波选择逻辑

  // 移除脑波相关逻辑，现在使用音乐实时波形
  
  /**
   * 场景卡片点击事件
   */
  onSceneTap: function (e) {
    const sceneId = parseInt(e.currentTarget.dataset.id);
    const sceneName = e.currentTarget.dataset.name;
    const scaleType = e.currentTarget.dataset.scaleType;
    const sceneTheme = e.currentTarget.dataset.sceneName;
    
    console.log('点击场景:', { sceneId, sceneName, scaleType, sceneTheme });
    
    // 验证场景ID
    if (!sceneId || isNaN(sceneId)) {
      console.error('无效的场景ID:', sceneId);
      wx.showToast({
        title: '场景ID无效',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到场景详情页面
    wx.navigateTo({
      url: `/pages/scene/detail/detail?sceneId=${sceneId}&sceneName=${encodeURIComponent(sceneName)}&scaleType=${scaleType || ''}&sceneTheme=${encodeURIComponent(sceneTheme || sceneName)}`
    });
  },

  /**
   * 查看全部场景
   */
  showAllScenes: function() {
    wx.navigateTo({
      url: '/pages/scene/list/list'
    });
  },
  
  
  /**
   * 获取分类名称
   */
  getCategoryName: function(categoryId) {
    const category = this.data.categories.find(cat => cat.id === categoryId);
    return category ? category.name : '未知分类';
  },
  
  /**
   * 根据分类ID获取图片
   */
  getAudioImageByCategory: function(categoryId) {
    // 使用统一的默认图片，避免404错误
    const defaultImage = '/assets/images/default-image.png'
    
    const imageMap = {
      1: defaultImage, // 助眠疗愈
      2: defaultImage, // 专注疗愈
      3: defaultImage, // 抑郁疗愈
      4: defaultImage, // 冥想疗愈（已屏蔽）
      5: defaultImage  // 放松疗愈
    };
    return imageMap[categoryId] || defaultImage;
  },
  



  /**
   * 查看分类详情
   */
  showCategoryDetail: function(e) {
    const categoryId = e.currentTarget.dataset.categoryId;
    const categoryName = this.getCategoryName(categoryId);
    
    wx.navigateTo({
      url: `/pages/music/library/library?categoryId=${categoryId}&categoryName=${categoryName}`
    });
  },
  
  /**
   * 格式化时长显示
   */
  formatDuration: function(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  /**
   * 使用统一音乐管理器获取音乐
   */
  getMusicFromUnifiedManager: function(categoryId) {
    unifiedMusicManager.getMusicByCategory(categoryId, {
      showLoading: true,
      loadingText: '获取音乐中...'
    }).then((musicData) => {
      console.log('统一管理器获取音乐成功:', musicData)
      
      // 使用全局播放器播放获取到的音乐
      this.playRecommendationWithGlobalPlayer(musicData)
      
      // 更新声音列表
      this.setData({
        sounds: [musicData]
      })
      
    }).catch((error) => {
      console.error('统一管理器获取音乐失败:', error)
      
      // 根据错误类型提供不同的提示和处理
      let errorMessage = '获取脑波失败'
      let showModal = false
      let modalTitle = '提示'
      let showSwitchButton = false
      
      if (error.message) {
        if (error.message.includes('没有音乐资源') || error.message.includes('暂无可用内容')) {
          // 分类中没有脑波资源
          errorMessage = error.message
          modalTitle = '分类暂无内容'
          showModal = true
          showSwitchButton = true
        } else if (error.message.includes('音频正在更新中')) {
          errorMessage = error.message
          modalTitle = '脑波更新中'
          showModal = true
          showSwitchButton = true
        } else if (error.message.includes('网络连接不稳定')) {
          errorMessage = error.message
          modalTitle = '网络问题'
          showModal = true
          showSwitchButton = false
        } else if (error.message.includes('音频URL无效') || error.message.includes('音频暂时无法访问')) {
          errorMessage = '脑波文件暂时无法访问，请稍后再试'
          modalTitle = '脑波加载失败'
          showModal = true
          showSwitchButton = true
        } else {
          // 其他错误使用原始错误信息
          errorMessage = error.message
        }
      }
      
      if (showModal) {
        const buttons = showSwitchButton ? {
          showCancel: true,
          cancelText: '知道了',
          confirmText: '切换分类'
        } : {
          showCancel: false,
          confirmText: '知道了'
        }
        
        wx.showModal({
          title: modalTitle,
          content: showSwitchButton ? 
            `${errorMessage}，您可以试试其他分类。` : 
            errorMessage,
          ...buttons,
          success: (res) => {
            if (res.confirm && showSwitchButton) {
              // 自动选择一个有音乐的分类
              this.selectAvailableCategory()
            }
          }
        })
      } else {
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2500
        })
      }
    })
  },
  
  /**
   * 选择一个可用的分类
   */
  selectAvailableCategory: function() {
    // 默认选择分类1（助眠疗愈）或分类5（放松疗愈），这些通常有内容
    const fallbackCategories = [1, 5, 3] // 移除ID=4（冥想疗愈已屏蔽）
    for (const categoryId of fallbackCategories) {
      if (categoryId !== this.data.selectedCategory) {
        this.setData({
          selectedCategory: categoryId
        })
        this.getMusicFromUnifiedManager(categoryId)
        break
      }
    }
  },
  
  /**
   * 加载音乐分类
   */
  async loadMusicCategories() {
    try {
      // 开始加载音乐分类
      const { MusicAPI } = require('../../utils/healingApi')
      
      // 从API获取分类数据
      const categoriesResult = await MusicAPI.getCategories().catch(error => {
        console.warn('获取分类API失败:', error)
        return { success: false, data: [] }
      })
      
      let categories = []
      
      if (categoriesResult.success && categoriesResult.data && categoriesResult.data.length > 0) {
        // 使用高效处理方法（filter+map一体化，带缓存）
        categories = this.processCategories(categoriesResult.data)
        // 从 API 加载分类成功
      } else {
        // API失败时使用默认分类
        categories = this.getDefaultCategories()
        // API 失败，使用默认分类
      }
      
      this.setData({
        categories: categories
      })
      
    } catch (error) {
      console.error('加载音乐分类失败:', error)
      // 使用默认分类作为降级
      this.setData({
        categories: this.getDefaultCategories()
      })
    }
  },

  /**
   * 清理可能的旧域名缓存
   */
  clearOldDomainCache() {
    try {
      // 清理音频缓存
      wx.removeStorageSync('audio_cache_info')
      wx.removeStorageSync('music_categories_cache')
      wx.removeStorageSync('qiniu_file_cache')
      wx.removeStorageSync('audio_playlist_cache')
      wx.removeStorageSync('user_music_cache')
      
      // 清理可能的URL缓存
      wx.removeStorageSync('qiniu_url_cache')
      wx.removeStorageSync('music_url_mapping')
      
      console.log('已清理旧域名缓存')
      
      wx.showToast({
        title: '缓存已清理，请重新加载',
        icon: 'success'
      })
      
      // 重新初始化音乐管理器
      setTimeout(() => {
        this.initUnifiedMusicManager()
      }, 1500)
      
    } catch (error) {
      console.error('清理缓存失败:', error)
      wx.showToast({
        title: '清理缓存失败',
        icon: 'error'
      })
    }
  },

  /**
   * 强制刷新分类数据（解决缓存导致的数据不同步问题）
   */
  forceRefreshCategories() {
    try {
      wx.showLoading({ title: '正在刷新分类数据...' })
      
      // 使用统一的强制刷新方法
      this.forceRefreshCategoriesFromManager()
      
    } catch (error) {
      wx.hideLoading()
      console.error('强制刷新分类数据失败:', error)
      wx.showToast({
        title: '刷新失败',
        icon: 'error'
      })
    }
  },

  /**
   * 手动刷新分类数据（给用户使用）- 简化版本
   */
  onManualRefreshCategories: function() {
    // 用户手动刷新分类数据
    
    wx.showLoading({
      title: '正在刷新...',
      mask: true
    })
    
    // 直接重新初始化管理器，从服务器获取最新数据
    this.initUnifiedMusicManager()
    
    // 2秒后隐藏loading（给用户反馈）
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '刷新完成',
        icon: 'success',
        duration: 1500
      })
    }, 2000)
  },





  /**
   * 直接从服务器加载分类数据（绕过缓存）
   */
  async loadMusicCategoriesFromServer() {
    try {
      // 强制从服务器加载音乐分类
      const { MusicAPI } = require('../../utils/healingApi')
      
      // 添加时间戳参数强制刷新
      const timestamp = Date.now()
      const categoriesResult = await MusicAPI.getCategories()
      
      if (categoriesResult.success && categoriesResult.data && categoriesResult.data.length > 0) {
        // 使用高效处理方法（filter+map一体化，带缓存）
        const categories = this.processCategories(categoriesResult.data).map(cat => ({
          ...cat,
          updated_at: timestamp // 添加更新时间戳
        }))
        
        this.setData({
          categories: categories
        })
        
        // 从服务器强制加载分类成功
        
        // 同时更新统一音乐管理器的分类数据
        await unifiedMusicManager.refreshCategories()
        
        return categories
      } else {
        throw new Error('服务器返回的分类数据为空或格式错误')
      }
      
    } catch (error) {
      console.error('强制加载音乐分类失败:', error)
      throw error
    }
  },



  /**
   * 获取默认分类（降级处理） - 添加明显标识
   */
  /**
   * 过滤分类数据，移除不应在前端显示的分类
   */
  filterCategories(categories) {
    if (!categories || !Array.isArray(categories)) return []
    // 过滤掉冥想疗愈分类（ID=4，AI生成音频，单独收费）以及“长序列冥想”等长序列相关分类
    const isLongSequenceCategory = (cat) => {
      const name = (cat.name || '').toString().toLowerCase()
      const code = (cat.code || cat.scale_type || cat.type || '').toString().toLowerCase()
      return (
        name.includes('长序列') ||
        (name.includes('long') && name.includes('sequence')) ||
        code.includes('long_sequence') ||
        code.includes('longsequence')
      )
    }
    // 显式屏蔽ID=4、ID=6（长序列冥想），以及名称/code匹配到的长序列类目
    return categories.filter(cat => cat.id !== 4 && cat.id !== 6 && !isLongSequenceCategory(cat))
  },

  /**
   * 运行时检测：识别接口返回的“长序列冥想”相关分类ID
   */
  detectLongSequenceCategoryIds(categories) {
    if (!Array.isArray(categories)) return []
    const toStr = (v) => (v || '').toString().toLowerCase()
    return categories
      .filter(cat => {
        const name = toStr(cat.name)
        const code = toStr(cat.code || cat.scale_type || cat.type)
        return (
          name.includes('长序列') ||
          (name.includes('long') && name.includes('sequence')) ||
          code.includes('long_sequence') ||
          code.includes('longsequence')
        )
      })
      .map(cat => cat.id)
      .filter(id => id !== undefined && id !== null)
  },

  // 分类处理缓存
  _lastRawCategories: null,
  _lastProcessedCategories: null,

  /**
   * 高效处理分类数据（filter + map 一体化，带缓存）
   */
  processCategories(rawCategories) {
    // 检查缓存
    if (this._lastRawCategories && 
        this._lastProcessedCategories &&
        JSON.stringify(rawCategories) === JSON.stringify(this._lastRawCategories)) {
      return this._lastProcessedCategories
    }

    // 一次性完成filter+map，避免两次遍历
    const processed = rawCategories
      .filter(cat => {
        const name = (cat.name || '').toString().toLowerCase()
        const code = (cat.code || cat.scale_type || cat.type || '').toString().toLowerCase()
        const isLongSeq = (
          name.includes('长序列') ||
          (name.includes('long') && name.includes('sequence')) ||
          code.includes('long_sequence') ||
          code.includes('longsequence')
        )
        return cat.id !== 4 && cat.id !== 6 && !isLongSeq
      }) // 过滤不需要的分类
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon || cat.emoji_code || '🎵',
        description: cat.description || '音乐分类',
        count: cat.music_count || cat.count || 0
      }))

    // 更新缓存
    this._lastRawCategories = rawCategories
    this._lastProcessedCategories = processed
    
    return processed
  },

  getDefaultCategories() {
    const defaultScenes = [
      { 
        id: 1, 
        name: '睡眠场景', 
        icon: '😴',
        description: '改善睡眠质量，获得深度休息',
        scaleType: 'PSQI', // 匹配的评测量表类型
        sceneName: '睡眠疗愈'
      },
      { 
        id: 2, 
        name: '专注场景', 
        icon: '🎯',
        description: '提升注意力，增强工作效率',
        scaleType: null, // 暂无直接对应的量表
        sceneName: '专注疗愈'
      },
      { 
        id: 3, 
        name: '抑郁场景', 
        icon: '🌈',
        description: '缓解抑郁情绪，重拾生活希望',
        scaleType: 'HAMD-17', // 匹配抑郁评测量表
        sceneName: '抑郁疗愈'
      },
      { 
        id: 4, 
        name: '焦虑场景', 
        icon: '🕊️',
        description: '缓解焦虑紧张，获得内心平静',
        scaleType: 'GAD-7', // 匹配焦虑评测量表
        sceneName: '焦虑疗愈'
      }
      // 重新设计场景分类，对应不同的疗愈需求和评测量表
    ]
    return this.filterCategories(defaultScenes)
  },

  
  
  
  /**
   * 显示我的音乐库
   */
  showMyMusicLibrary: function() {
    wx.switchTab({
      url: '/pages/music/library/library'
    });
  },
  

  
  onSoundTap: function (e) {
    const soundId = e.currentTarget.dataset.id;
    const sound = this.data.sounds.find(s => s.id === soundId);
    
    if (!sound) return;
    
    // 如果点击当前正在播放的声音，则暂停
    if (this.data.playingSoundId === soundId && this.data.isPlaying) {
      this.pausePlayback();
      return;
    }
    
    // 使用全局播放器播放声音
    this.playRecommendationWithGlobalPlayer(sound);
  },
  
  startPlayback: function (sound) {
    // 记录播放行为
    this.recordPlayStart(sound);
    
    // 立即更新UI状态，提高响应速度
    let brainwaveInfo = {
      baseFreq: sound.baseFreq || null,
      beatFreq: sound.beatFreq || null,
      currentTime: 0,
      totalTime: this.data.selectedDuration * 60
    };
    
    // 对于非脑波音频，显示合适的频率信息
    if (!sound.baseFreq && !sound.beatFreq) {
      // 兼容旧的分类检查逻辑，同时支持新的分类ID
      if (sound.category === '助眠疗愈' || sound.category === '自然音' || sound.categoryId === 1 || sound.category_id === 1) {
        brainwaveInfo.baseFreq = '8-15';
        brainwaveInfo.beatFreq = '10';
      } else if (sound.category === '专注疗愈' || sound.category === '白噪音') {
        brainwaveInfo.baseFreq = '20-20K';
        brainwaveInfo.beatFreq = 'Full';
      } else {
        brainwaveInfo.baseFreq = '混合';
        brainwaveInfo.beatFreq = '动态';
      }
    }
    
    this.setData({
      isPlaying: true,
      playingSoundId: sound.id,
      currentSound: sound,
      brainwaveInfo: brainwaveInfo
    });
    
    // 旧的波形动画代码已移除，现在使用实时脑波组件
    
    // 停止之前的播放
    if (this.data.brainwavePlayer) {
      this.data.brainwavePlayer.stop();
    }
    
    // 停止之前的普通音频播放
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer.destroy();
      this.audioPlayer = null;
    }
    
    // 音频文件播放逻辑
    console.log('开始播放声音:', sound.name, '时长:', this.data.selectedDuration, '分钟');
    
    // 添加错误重试机制
    let retryCount = 0;
    const maxRetries = 2;
      
    // 先检查音频格式是否支持
    const playWithFormatCheck = async (url, isBackupUrl = false) => {
      try {
        // 显示加载提示
        if (!isBackupUrl) {
          wx.showLoading({
            title: '加载音频中...',
            mask: false
          });
        }
          
          // 检查音频格式是否支持
          const isFormatSupported = await this.checkAudioFormat(url);
          
          // 隐藏加载提示
          wx.hideLoading();
          
          if (isFormatSupported) {
            // 音频格式支持，直接播放
            tryPlayAudio(url, isBackupUrl);
          } else {
            // 音频格式不支持或URL已过期
            console.warn('音频格式不支持或URL已过期:', url);
            
            if (!isBackupUrl && sound.backupPath) {
              // 尝试使用备选URL
              console.log('尝试使用备选URL:', sound.backupPath);

              // 确保隐藏之前的loading
              wx.hideLoading();

              wx.showToast({
                title: '正在切换到备选音频...',
                icon: 'loading',
                duration: 1000
              });
              setTimeout(() => {
                playWithFormatCheck(sound.backupPath, true);
              }, 500);
            } else {
              // 无法继续重试，显示错误
              console.error('所有音频源都无法播放:', {
                originalUrl: sound.path,
                backupUrl: sound.backupPath,
                isBackupUrl: isBackupUrl
              });
              wx.showToast({
                title: '音频暂时无法播放，请稍后重试',
                icon: 'none',
                duration: 2000
              });
              this.stopPlayback();
            }
          }
        } catch (err) {
          // 隐藏加载提示
          wx.hideLoading();
          
          console.error('音频格式检测失败:', err);
          
          // 发生错误，尝试直接播放
          tryPlayAudio(url, isBackupUrl);
        }
      };
      
      const tryPlayAudio = (url, isBackupUrl = false) => {
        // 使用App中的增强音频上下文
        const audioPlayer = this.app.createEnhancedAudio({
          src: url,
          loop: false,
          onPlay: () => {
            console.log('音频开始播放' + (isBackupUrl ? '(使用备选URL)' : ''));
          },
          onError: (err) => {
            console.error('音频播放错误:', err);
            
            // 立即更新UI状态为停止播放
            this.setData({
              isPlaying: false
            });
            
            // 检查是否可以重试
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`尝试重新播放 (${retryCount}/${maxRetries})...`);
              
              // 使用不同的播放策略重试
              if (retryCount === 1) {
                // 第一次重试：使用不同的音频上下文
                console.log('使用新的音频上下文重试');
                if (this.audioPlayer) {
                  this.audioPlayer.destroy();
                }
                setTimeout(() => {
                  // 重新设置播放状态
                  this.setData({
                    isPlaying: true
                  });
                  // 旧的波形动画代码已移除
                  tryPlayAudio(url, isBackupUrl);
                }, 500);
              } else if (!isBackupUrl && sound.backupPath) {
                // 第二次重试：尝试使用备选URL
                console.log('尝试使用备选URL:', sound.backupPath);

                // 确保隐藏之前的loading
                wx.hideLoading();

                wx.showToast({
                  title: '正在切换到备选音频...',
                  icon: 'loading',
                  duration: 1000
                });
                setTimeout(() => {
                  // 重新设置播放状态
                  this.setData({
                    isPlaying: true
                  });
                  // 旧的波形动画代码已移除
                  tryPlayAudio(sound.backupPath, true);
                }, 500);
              } else {
                // 无法继续重试，尝试播放本地音频
                console.error('音频播放彻底失败，尝试播放本地音频:', {
                  url: url,
                  isBackupUrl: isBackupUrl,
                  retryCount: retryCount,
                  error: err
                });
                
                // 尝试获取并播放本地音频
                this.playLocalFallbackAudio(sound);
              }
            } else {
              // 重试次数已用完，尝试播放本地音频
              console.log('重试次数已用完，尝试播放本地音频');
              this.playLocalFallbackAudio(sound);
            }
          },
          onEnded: () => {
        console.log('音频播放结束');
        // 如果设置了循环播放，则重新开始
        if (this.data.selectedDuration > 0) {
          audioPlayer.seek(0);
          audioPlayer.play();
        } else {
          this.stopPlayback();
            }
        }
      });
      
      // 开始播放
      audioPlayer.play();
      
      // 保存播放器引用
      this.audioPlayer = audioPlayer;
      };
      
      // 处理不同来源的音频路径
      if (sound.id && sound.id.startsWith('qiniu_natural_')) {
        // 七牛云音频，直接使用完整URL
        console.log('播放七牛云音频:', sound.path);
        
        // 设置备选路径为本地音频
        if (!sound.backupPath) {
          sound.backupPath = this.getBackupAudioUrl(sound);
        }
        
        // 使用格式检测播放
        playWithFormatCheck(sound.path);
      } else if (sound.id && sound.id.startsWith('qiniu_file_')) {
        // 七牛云文件列表音频
        console.log('播放七牛云文件列表音频:', sound.path);
        
        // 设置备选路径为本地音频
        if (!sound.backupPath) {
          sound.backupPath = this.getBackupAudioUrl(sound);
        }
        
      // 使用格式检测播放
      playWithFormatCheck(sound.path);
    } else {
      // 服务器音频，构建完整URL
      let audioPath = sound.path || sound.audioUrl;
      
      // 如果是相对路径，转换为完整URL
      if (audioPath && audioPath.startsWith('/')) {
        const config = getCurrentConfig()
        const baseUrl = config.STATIC_BASE_URL || config.API_BASE_URL.replace('/api', '')
        audioPath = `${baseUrl}${audioPath}`
      }
      
      console.log('播放服务器音频:', audioPath);
      
      // 使用完整URL播放
      tryPlayAudio(audioPath);
    }
    
    // 启动计时器更新播放时间
    this.startPlaybackTimer();
  },
  
  // 开始播放计时器
  startPlaybackTimer: function() {
    // 清除之前的计时器
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
    
    const startTime = Date.now();
    const totalTime = this.data.selectedDuration * 60; // 转换为秒
    
    this.playbackTimer = setInterval(() => {
      if (!this.data.isPlaying) {
        clearInterval(this.playbackTimer);
        return;
      }
      
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      // 更新播放时间
      let brainwaveInfo = this.data.brainwaveInfo;
      brainwaveInfo.currentTime = elapsedSeconds;
      
      this.setData({
        brainwaveInfo: brainwaveInfo
      });
      
      // 检查是否播放完成
      if (elapsedSeconds >= totalTime) {
        this.stopPlayback();
      }
    }, 1000);
  },
  
  pausePlayback: function () {
    // 立即更新UI状态
    this.setData({
      isPlaying: false
    });
    
    // 旧的波形动画代码已移除，现在使用实时脑波组件
    
    // 暂停计时器
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
    
    // 异步暂停脑波播放，不阻塞UI
    if (this.data.brainwavePlayer) {
      setTimeout(() => {
        this.data.brainwavePlayer.pause();
      }, 0);
    }
    
    // 暂停普通音频播放
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
    
    console.log('暂停播放');
  },
  
  resumePlayback: function () {
    // 立即更新UI状态
    this.setData({
      isPlaying: true
    });
    
    // 恢复波形动画
    // 旧的波形动画代码已移除
    
    // 异步恢复脑波播放，不阻塞UI
    if (this.data.brainwavePlayer) {
      setTimeout(() => {
        this.data.brainwavePlayer.resume();
      }, 0);
    }
    
    // 恢复普通音频播放
    if (this.audioPlayer) {
      this.audioPlayer.play();
    }
    
    // 重新启动计时器
    this.startPlaybackTimer();
    
    console.log('恢复播放');
  },
  
  stopPlayback: function () {
    // 记录播放结束
    this.recordPlayEnd();
    
    // 停止播放
    if (this.data.brainwavePlayer) {
      this.data.brainwavePlayer.stop();
    }
    
    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }
    
    // 更新UI状态
    this.setData({
      isPlaying: false,
      playingSoundId: null
    });
    
    // 停止波形动画
    // 旧的波形动画代码已移除
    
    // 停止计时器
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
  },
  
  // 检测音频格式是否支持
  checkAudioFormat: async function(url) {
    return new Promise(async (resolve) => {
      // 如果是本地文件，直接返回true
      if (url.startsWith('/')) {
        resolve(true);
        return;
      }
      
      // 后端现在统一返回已签名的URL，不再需要前端重复处理
      // 移除重复签名逻辑，避免参数重复拼接问题
      
      // 创建临时音频上下文测试
      const testAudio = wx.createInnerAudioContext();
      testAudio.src = url;
      
      // 设置超时，避免长时间等待
      const timeout = setTimeout(() => {
        testAudio.destroy();
        resolve(false);
      }, 3000);
      
      // 监听可以播放事件
      testAudio.onCanplay(() => {
        clearTimeout(timeout);
        testAudio.destroy();
        resolve(true);
      });
      
      // 监听错误事件
      testAudio.onError((err) => {
        clearTimeout(timeout);
        console.error('音频格式检测失败:', err);
        testAudio.destroy();
        resolve(false);
      });
    });
  },
  
  // 获取备选音频URL
  getBackupAudioUrl: function(sound) {
    // 如果已有备选URL，直接返回
    if (sound.backupPath) {
      return sound.backupPath;
    }
    
    // 统一使用后端静态资源作为备选，避免小程序包内缺失
    try {
      const apiBase = getApp().globalData.apiBaseUrl || ''
      const origin = apiBase ? apiBase.replace(/\/api\/?$/, '') : ''
      return origin ? `${origin}/assets/audio/test.mp3` : '/assets/audio/test.mp3'
    } catch (e) {
      return '/assets/audio/test.mp3'
    }
  },
  
  // 播放本地回退音频
  playLocalFallbackAudio: function(failedSound) {
    console.log('播放本地回退音频，原音频:', failedSound);
    
    // 使用统一音乐管理器的回退机制
    const categoryId = this.data.selectedCategory;
    if (categoryId) {
      unifiedMusicManager.getMusicByCategory(categoryId, {
        allowFallback: true,
        showLoading: false
      }).then((fallbackMusic) => {
        console.log('获取回退音频成功:', fallbackMusic.name);
        
        // 更新当前声音信息
        this.setData({
          currentSound: fallbackMusic
        });
        
        // 重新尝试播放
        setTimeout(() => {
          this.startPlayback(fallbackMusic);
        }, 1000);
        
        wx.showToast({
          title: '已切换到备用音频',
          icon: 'success',
          duration: 2000
        });
      }).catch((error) => {
        console.error('获取回退音频失败:', error);
        wx.showToast({
          title: '音频播放失败',
          icon: 'none',
          duration: 2000
        });
        this.stopPlayback();
      });
    } else {
      wx.showToast({
        title: '音频播放失败',
        icon: 'none',
        duration: 2000
      });
      this.stopPlayback();
    }
  },
  
  togglePlayPause: function () {
    console.log('togglePlayPause 被触发, 当前播放状态:', this.data.isPlaying);
    
    // 立即切换播放/暂停按钮状态，提高响应速度
    if (this.data.isPlaying) {
      // 如果当前正在播放，则暂停
      // 先更新UI状态
      this.setData({
        isPlaying: false
      });
      // 然后异步执行暂停逻辑
      setTimeout(() => {
        this.pausePlayback();
      }, 0);
    } else if (this.data.currentSound && (this.data.brainwavePlayer || this.audioPlayer)) {
      // 如果有当前声音且有播放器，恢复播放
      // 先更新UI状态
      this.setData({
        isPlaying: true
      });
      // 然后异步执行恢复播放逻辑
      setTimeout(() => {
        this.resumePlayback();
      }, 0);
    } else {
      // 如果没有正在播放的内容，根据当前选择的分类决定播放行为
      const categoryId = this.data.selectedCategory;
      
      switch (categoryId) {
        case 1: // 助眠疗愈
        case 2: // 专注疗愈
        case 3: // 抑郁疗愈
        case 5: // 放松疗愈
        // 注意：case 4（冥想疗愈）已移除，因为AI生成音频已屏蔽
          // 使用统一音乐管理器获取音乐
          this.getMusicFromUnifiedManager(categoryId);
          break;
          
        default:
          // 默认情况下，提示用户选择声音类型
          wx.showToast({
            title: '请先选择声音类型',
            icon: 'none',
            duration: 2000
          });
          break;
      }
    }
  },
  
  showAllCategories: function () {
    wx.navigateTo({
      url: '/pages/categories/categories'
    });
  },
  
  showAllBrainwaves: function () {
    wx.navigateTo({
      url: '/pages/brainwaves/brainwaves'
    });
  },
  
  

  
  loadSoundData: function() {
    // 不再需要预加载静态声音数据
    // 统一音乐管理器会按需获取
    console.log('统一音乐管理器已接管音乐数据加载');
  },
  

  
  // 所有旧的波形方法已删除，现在使用 brainwave-realtime 组件
  
  // 旧的停止波形动画方法已删除
  
  // 停止所有音频播放
  stopAllAudio: function() {
    // 停止脑波播放
    if (this.data.brainwavePlayer) {
      this.data.brainwavePlayer.stop();
      this.setData({
        brainwavePlayer: null
      });
    }
    
    // 停止普通音频播放
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer = null;
    }
    
    // 停止计时器
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
  },

  // 处理图片加载错误
  handleImageError: function(e) {
    console.log('图片加载失败:', e);
    const type = e.currentTarget.dataset.type;
    
    if (type === 'playback') {
      // 处理播放控制区的图片
      let currentSound = this.data.currentSound;
      currentSound.image = this.data.defaultImageUrl;
      
      this.setData({
        currentSound: currentSound
      });
      
      console.log('已替换为默认图片');
    }
  },

  // 蓝牙设备管理功能已移至设备管理页面
  // /**
  //  * 获取允许的已连接蓝牙设备
  //  */
  // fetchAllowedConnectedDevices: function() {
  //   // 确保btManager已初始化
  //   if (!this.btManager) {
  //     this.btManager = bluetoothManager.getBluetoothManager();
  //   }
  //   const that = this;
  //   this.btManager.getAllowedConnectedDevices().then(devices => {
  //     that.setData({
  //       allowedConnectedDevices: devices || []
  //     });
  //     // 默认选中第一个
  //     if (devices && devices.length > 0) {
  //       that.setData({ selectedBluetoothDeviceId: devices[0].deviceId });
  //     } else {
  //       that.setData({ selectedBluetoothDeviceId: '' });
  //     }
  //   }).catch(() => {
  //     that.setData({ allowedConnectedDevices: [], selectedBluetoothDeviceId: '' });
  //   });
  // },
  // 蓝牙设备选择功能已移至设备管理页面
  // /**
  //  * 选择蓝牙设备
  //  */
  // onSelectBluetoothDevice: function(e) {
  //   const deviceId = e.currentTarget.dataset.deviceid;
  //   this.setData({ selectedBluetoothDeviceId: deviceId });
  // },

  // 初始化全局播放器
  initGlobalPlayer() {
    // 在app实例中设置全局播放器引用
    if (this.app.globalData) {
      this.app.globalData.globalPlayer = this
    }
  },





  // 全局播放器事件处理
  onGlobalPlayerStateChange(e) {
    const { isPlaying, progress, currentTime, duration, currentTrack } = e.detail
    
    // 计算播放进度百分比
    let playProgress = 0
    if (duration > 0) {
      playProgress = (currentTime / duration) * 100
    } else if (progress !== undefined) {
      playProgress = progress
    }
    
    // 更新当前音乐信息（确保分类信息同步）
    const updateData = { 
      isPlaying,
      playProgress: Math.max(0, Math.min(100, playProgress))
    }
    
    // 如果有音轨信息，更新当前音乐
    if (currentTrack && currentTrack.name) {
      updateData.currentSound = {
        id: currentTrack.id,
        name: currentTrack.name,
        title: currentTrack.title || currentTrack.name,
        category: currentTrack.category,
        categoryId: currentTrack.categoryId,
        type: currentTrack.type,
        duration: currentTrack.duration,
        image: currentTrack.image
      }
      updateData.playingSoundId = currentTrack.id
    }
    
    this.setData(updateData)
    
    console.log('播放状态变化:', isPlaying, '进度:', playProgress.toFixed(1) + '%', '当前音乐:', currentTrack?.name, '分类:', currentTrack?.category)
  },

  onNextTrack() {
    console.log('下一首')
    // 可以实现切换到下一首的逻辑
  },

  onPreviousTrack() {
    console.log('上一首')
    // 可以实现切换到上一首的逻辑
  },

  onCloseGlobalPlayer() {
    this.setData({ 
      showGlobalPlayer: false,
    })
    console.log('关闭全局播放器')
  },

  // 静态波形点击跳转处理 - 已废弃
  // onWaveformSeek(e) {
  //   const { progress } = e.detail
  //   console.log('首页波形跳转请求:', progress + '%')
    
  //   // 触发全局播放器的跳转事件
  //   this.triggerEvent('seek', { progress })
    
  //   // 或者通过全局播放器组件引用直接调用
  //   const globalPlayer = this.selectComponent('#global-player')
  //   if (globalPlayer) {
  //     globalPlayer.seekToProgress(progress)
  //   }
  // },

  onExpandGlobalPlayer(e) {
    const { track } = e.detail
    console.log('展开播放器', track)
    // 可以跳转到详细播放页面
    wx.navigateTo({
      url: '/pages/player/player'
    })
  },

  /**
   * 记录播放开始
   */
  recordPlayStart: function(sound) {
    try {
      // 检查用户登录状态
      if (!this.data.isLoggedIn) {
        console.log('用户未登录，跳过播放记录');
        return;
      }

      // 记录播放开始时间和信息
      this.currentPlayRecord = {
        sound: sound,
        startTime: Date.now(),
        totalDuration: this.data.selectedDuration * 60, // 设定的播放时长(秒)
      };

      console.log('开始记录播放:', sound.name || sound.title);
    } catch (error) {
      console.error('记录播放开始失败:', error);
    }
  },

  /**
   * 记录播放结束
   */
  recordPlayEnd: function() {
    try {
      if (!this.currentPlayRecord || !this.data.isLoggedIn) {
        return;
      }

      const endTime = Date.now();
      const actualPlayDuration = Math.floor((endTime - this.currentPlayRecord.startTime) / 1000); // 实际播放时长(秒)
      const sound = this.currentPlayRecord.sound;

      // 只记录播放超过5秒的记录
      if (actualPlayDuration < 5) {
        console.log('播放时间过短，跳过记录');
        return;
      }

      // 计算播放进度
      const playProgress = this.currentPlayRecord.totalDuration > 0 
        ? Math.min(actualPlayDuration / this.currentPlayRecord.totalDuration, 1.0)
        : 0.0;

      // 确定内容类型
      let contentType = 'healing_resource';
      if (sound.id && sound.id.startsWith('brainwave_')) {
        contentType = 'brainwave';
      } else if (sound.source === 'smart_manager') {
        contentType = 'preset_music';
      } else if (sound.source === 'generated') {
        contentType = 'generated_music';
      }

      // 创建播放记录
      const playRecordData = {
        content_type: contentType,
        content_id: sound.id || 'unknown',
        content_title: sound.name || sound.title || '未知音乐',
        category_name: sound.category || sound.category_name || '未知分类',
        category_id: sound.categoryId || sound.category_id,
        play_duration: actualPlayDuration,
        total_duration: this.currentPlayRecord.totalDuration,
        play_progress: playProgress,
        device_type: 'miniprogram',
        play_source: 'homepage'
      };

      console.log('🎵 播放记录数据准备提交:', playRecordData);
      console.log('🎵 播放时长:', actualPlayDuration, '秒，进度:', (playProgress * 100).toFixed(1) + '%');

      // 调用API记录播放记录
      const api = require('../../utils/api');
      api.request({
        url: '/play-records/',
        method: 'POST',
        data: playRecordData,
        showLoading: false
      }).then((result) => {
        if (result.success) {
          console.log('✅ 播放记录创建成功:', result.data);
          console.log('📝 记录ID:', result.data.id);
          console.log('📊 播放数据:', {
            时长: actualPlayDuration + '秒',
            内容: sound.name || sound.title,
            类型: contentType
          });
          
          // 通知其他页面刷新统计数据
          this.notifyStatsUpdate();
        } else {
          console.warn('❌ 播放记录创建失败:', result.error);
          console.warn('❌ 失败的数据:', playRecordData);
        }
      }).catch((error) => {
        console.error('❌ 创建播放记录失败:', error);
        console.error('❌ 请求数据:', playRecordData);
      });

      // 清除当前播放记录
      this.currentPlayRecord = null;

    } catch (error) {
      console.error('记录播放结束失败:', error);
    }
  },

  /**
   * 通知其他页面更新统计数据
   */
  notifyStatsUpdate() {
    try {
      // 使用事件总线通知
      const eventEmitter = require('../../utils/eventEmitter');
      eventEmitter.emit('statsUpdated', {
        timestamp: Date.now()
      });

      // 通知个人资料页面更新
      const pages = getCurrentPages();
      pages.forEach(page => {
        if (page.route === 'pages/profile/profile' && page.refreshUserStats) {
          page.refreshUserStats();
        }
      });

      console.log('已通知页面刷新统计数据');
    } catch (error) {
      console.error('通知统计数据更新失败:', error);
    }
  }
});
