// pages/index/index.js
const app = getApp()
const util = require('../../utils/util.js')
const { unifiedMusicManager } = require('../../utils/unifiedMusicManager')
const AuthService = require('../../services/AuthService')
const { getCurrentConfig } = require('../../utils/config')
const { MusicAPI, LongSequenceAPI } = require('../../utils/healingApi')
const { recommendationEngine } = require('../../utils/recommendationEngine')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    brainwaveInfo: {
      baseFreq: null,
      beatFreq: null,
      currentTime: 0,
      totalTime: 0
    },
    selectedMood: 'sleep',
    selectedDuration: 30, // 恢复这个变量，代码中还在使用
    selectedCategory: 1,
    sounds: [],
    isPlaying: false,
    playingSoundId: null,
    currentSound: {},
    playProgress: 0, // 播放进度 0-100
    
    // 推荐音乐相关
    recommendedMusic: [],
    currentRecommendedId: null,
    
    // 分类推荐音频
    categoryRecommendations: [],
    categories: [],
    // 移除脑波类型定义，现在使用音乐实时分析
    audioContext: null,
    brainwavePlayer: null,
    defaultImageUrl: '/assets/images/default-image.png', // 添加默认图片路径
    
    // 全局播放器相关
    showGlobalPlayer: false,
    isLoading: false
  },
  
  onLoad: function () {
    // 延迟检查登录状态，确保App实例已初始化
    setTimeout(() => {
      try {
        // 强制检查登录状态
        if (!this.checkAndRequireLogin()) {
          return; // 如果未登录，停止页面初始化
        }
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
    
    // 加载推荐音乐
    this.loadRecommendedMusic();

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
        
        // 如果已登录，刷新推荐音乐
        if (this.data.isLoggedIn && this.data.userInfo) {
          this.loadRecommendedMusic();
        }
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
   * 初始化统一音乐管理器（统一的分类数据源）
   */
  initUnifiedMusicManager: function() {
    // 显示加载提示
    this.setData({ isLoading: true })
    
    unifiedMusicManager.init().then((success) => {
      if (success) {
        console.log('统一音乐管理器初始化成功')
        
        // 获取最新的分类数据
        const categories = unifiedMusicManager.getAllCategories()
        
        // 检查分类数据是否为空或过旧
        if (categories.length === 0 || this.isCategoryDataStale(categories)) {
          console.log('检测到分类数据过旧或为空，强制从服务器刷新...')
          this.forceRefreshCategoriesFromManager()
        } else {
          // 使用现有的分类数据
          this.setData({
            categories: categories,
            isLoading: false
          })
          
          console.log('分类数据已更新:', categories.length)
          
          // 加载默认分类的推荐音乐
          if (this.data.selectedCategory) {
            console.log('开始加载默认分类推荐音乐:', this.data.selectedCategory)
            this.loadCategoryRecommendations(this.data.selectedCategory);
          }
        }
      } else {
        console.warn('统一音乐管理器初始化失败，尝试强制刷新')
        this.forceRefreshCategoriesFromManager()
      }
    }).catch((error) => {
      console.error('初始化统一音乐管理器失败:', error)
      this.setData({ isLoading: false })
      
      // 尝试强制刷新作为降级方案
      this.forceRefreshCategoriesFromManager()
    })
  },

  /**
   * 检查分类数据是否过旧（需要刷新）
   */
  isCategoryDataStale: function(categories) {
    if (!categories || categories.length === 0) {
      return true
    }
    
    // 检查是否有数据库更新后的新分类（可以根据实际需求调整判断逻辑）
    // 例如：检查特定分类是否存在，或者检查更新时间戳
    
    // 简单检查：如果分类数量少于4个，可能是旧数据
    if (categories.length < 4) {
      console.log('分类数量异常，可能是旧数据:', categories.length)
      return true
    }
    
    // 检查是否有特定的新分类（根据你的数据库更新内容调整）
    const hasExpectedCategories = categories.some(cat => 
      cat.name && cat.id && cat.name !== '未知分类'
    )
    
    if (!hasExpectedCategories) {
      console.log('分类数据格式异常，需要刷新')
      return true
    }
    
    return false
  },

  /**
   * 通过统一管理器强制刷新分类数据
   */
  forceRefreshCategoriesFromManager: function() {
    console.log('通过统一管理器强制刷新分类数据...')
    
    // 清理缓存并强制从服务器获取
    unifiedMusicManager.clearCache()
    
    unifiedMusicManager.refreshCategories().then((success) => {
      if (success) {
        const categories = unifiedMusicManager.getAllCategories()
        
        this.setData({
          categories: categories,
          isLoading: false
        })
        
        console.log('分类数据强制刷新成功:', categories.length)
        
        // 显示刷新成功提示
        wx.showToast({
          title: '分类数据已更新',
          icon: 'success'
        })
        
        // 重新加载推荐音乐
        if (this.data.selectedCategory) {
          this.loadCategoryRecommendations(this.data.selectedCategory);
        }
      } else {
        // 如果还是失败，使用默认分类
        console.warn('强制刷新也失败，使用默认分类')
        this.setData({
          categories: this.getDefaultCategories(),
          isLoading: false
        })
        
        this.loadFallbackRecommendations();
      }
    }).catch((error) => {
      console.error('强制刷新分类失败:', error)
      this.setData({
        categories: this.getDefaultCategories(),
        isLoading: false
      })
      
      wx.showToast({
        title: '获取分类失败，使用默认分类',
        icon: 'none'
      })
      
      this.loadFallbackRecommendations();
    })
  },

  /**
   * 检查并要求登录
   */
  checkAndRequireLogin: function() {
    try {
      const userInfo = AuthService.getCurrentUser();
      const loggedIn = !!userInfo;

      console.log('首页强制登录检查:', loggedIn ? '已登录' : '未登录');

      if (!loggedIn) {
        // 未登录，立即跳转到登录页
        console.log('用户未登录，跳转到登录页');

        wx.showModal({
          title: '欢迎使用medsleep疗愈',
          content: '请先登录以享受完整的个性化疗愈体验',
          confirmText: '立即登录',
          showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/index/index')
          });
        }
      });

      return false;
    }

      // 已登录，更新页面数据
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });

      console.log('用户已登录:', userInfo.nickname || userInfo.username);
      return true;
    } catch (error) {
      console.error('检查登录状态时发生错误:', error);
      // 发生错误时，设置为未登录状态
      this.setData({
        isLoggedIn: false,
        userInfo: null
      });
      return false;
    }
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

      return loggedIn;
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 发生错误时，设置为未登录状态
      this.setData({
        isLoggedIn: false,
        userInfo: null
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
  
  onCategoryTap: function (e) {
    const categoryId = parseInt(e.currentTarget.dataset.id);
    
    console.log('分类卡片点击事件:', {
      categoryId,
      dataset: e.currentTarget.dataset,
      categories: this.data.categories
    });
    
    // 验证分类ID
    if (!categoryId || isNaN(categoryId)) {
      console.error('无效的分类ID:', categoryId);
      wx.showToast({
        title: '分类ID无效',
        icon: 'none'
      });
      return;
    }
    
    // 找到对应的分类信息
    const category = this.data.categories.find(cat => cat.id === categoryId);
    const categoryName = category ? category.name : '未知分类';
    
    console.log('点击分类:', categoryId, categoryName);
    
    // 更新选中状态
    this.setData({
      selectedCategory: categoryId
    });
    
    // 加载该分类的推荐音频
    this.loadCategoryRecommendations(categoryId);
  },
  
  /**
   * 加载分类推荐音频
   */
  async loadCategoryRecommendations(categoryId) {
    try {
      wx.showLoading({ title: '加载推荐...' });
      
      // 构建用户上下文
      const userContext = this.data.isLoggedIn ? {
        userId: this.data.userInfo?.id || this.data.userInfo?.user_id,
        userInfo: this.data.userInfo
      } : null;
      
      // 使用推荐引擎获取分类推荐
      const recommendations = await recommendationEngine.getCategoryRecommendations(
        categoryId, 
        3, 
        userContext
      );
      
      console.log(`分类${categoryId}推荐音频加载完成:`, recommendations.length);
      
      this.setData({
        categoryRecommendations: recommendations
      });
      
      wx.hideLoading();
      
    } catch (error) {
      wx.hideLoading();
      console.error('加载分类推荐失败:', error);
      
      this.setData({
        categoryRecommendations: []
      });
    }
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
      1: defaultImage, // 自然音
      2: defaultImage, // 白噪音
      3: defaultImage, // 脑波音频
      4: defaultImage, // AI音乐
      5: defaultImage  // 疗愈资源
    };
    return imageMap[categoryId] || defaultImage;
  },
  
  /**
   * 点击推荐音频
   */
  onRecommendationTap: function(e) {
    const music = e.currentTarget.dataset.music;
    console.log('点击推荐音频:', music.title);
    
    // 使用全局播放器播放推荐的音频
    this.playRecommendationWithGlobalPlayer(music);
  },

  /**
   * 使用全局播放器播放推荐音频（统一方法）
   */
  playRecommendationWithGlobalPlayer: function(music) {
    console.log('使用全局播放器播放推荐音频:', music);
    
    // 准备播放器需要的音乐数据格式
    const trackInfo = {
      name: music.title || music.name || '未知音乐',
      url: music.path || music.audioUrl || 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      image: music.image || '/images/default-music-cover.svg',
      category: music.category || '推荐音乐',
      type: music.type || 'music',
      id: music.id || 'temp_' + Date.now(),
      duration: music.duration || 180
    };
    
    // 如果是相对路径，转换为完整URL
    if (trackInfo.url && trackInfo.url.startsWith('/')) {
      const config = getCurrentConfig();
      const baseUrl = config.STATIC_BASE_URL || config.API_BASE_URL.replace('/api', '');
      trackInfo.url = `${baseUrl}${trackInfo.url}`;
    }
    
    console.log('准备播放的音乐信息:', trackInfo);
    
    // 显示吸底播放器
    this.setData({
      showGlobalPlayer: true
    });
    
    console.log('设置 showGlobalPlayer: true');
    
    // 延迟调用播放器
    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer');
      console.log('找到 globalPlayer 组件:', !!globalPlayer);
      console.log('组件实例:', globalPlayer);
      console.log('当前页面 showGlobalPlayer 状态:', this.data.showGlobalPlayer);
      
      if (globalPlayer && globalPlayer.playTrack) {
        console.log('调用 globalPlayer.playTrack');
        globalPlayer.playTrack(trackInfo);
      } else if (globalPlayer && globalPlayer.testShow) {
        console.warn('playTrack方法不存在，尝试测试方法');
        globalPlayer.testShow();
      } else {
        console.warn('Global player组件未找到或方法不存在，尝试直接设置组件数据');
        if (globalPlayer) {
          globalPlayer.setData({
            currentTrack: trackInfo,
            isVisible: true
          });
          console.log('直接设置组件数据完成');
        } else {
          console.error('组件完全未找到');
          wx.showToast({
            title: '播放器初始化失败',
            icon: 'none'
          });
        }
      }
    }, 200);
  },

  /**
   * 点击播放推荐音乐按钮
   */
  onPlayRecommendation: function(e) {
    const music = e.currentTarget.dataset.music;
    console.log('播放推荐音乐:', music);
    
    // 使用统一的全局播放器方法
    this.playRecommendationWithGlobalPlayer(music);
  },

  /**
   * 加载备用推荐音乐（当统一音乐管理器初始化失败时使用）
   */
  loadFallbackRecommendations: function() {
    console.log('加载备用推荐音乐');
    
    const categoryId = this.data.selectedCategory || 1;
    const categoryName = this.getCategoryName(categoryId);
    
    // 创建一些备用推荐音乐（使用网络音频源或预设音频）
    const fallbackRecommendations = [
      {
        id: `fallback_${categoryId}_1`,
        title: `${categoryName}精选1`,
        category: categoryName,
        category_id: categoryId,
        duration: 180,
        path: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // 使用公开的测试音频
        image: this.getAudioImageByCategory(categoryId)
      },
      {
        id: `fallback_${categoryId}_2`,
        title: `${categoryName}精选2`,
        category: categoryName,
        category_id: categoryId,
        duration: 240,
        path: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // 使用公开的测试音频
        image: this.getAudioImageByCategory(categoryId)
      },
      {
        id: `fallback_${categoryId}_3`,
        title: `${categoryName}精选3`,
        category: categoryName,
        category_id: categoryId,
        duration: 300,
        path: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // 使用公开的测试音频
        image: this.getAudioImageByCategory(categoryId)
      }
    ];
    
    this.setData({
      categoryRecommendations: fallbackRecommendations
    });
    
    console.log('备用推荐音乐加载完成:', fallbackRecommendations.length);
  },

  /**
   * 手动加载推荐音乐（用于调试）
   */
  manualLoadRecommendations: function() {
    console.log('手动加载推荐音乐');
    
    const categoryId = this.data.selectedCategory || 1;
    console.log('当前选中分类:', categoryId);
    
    // 先尝试使用统一音乐管理器
    this.loadCategoryRecommendations(categoryId);
    
    // 如果3秒后还没有加载成功，使用备用方案
    setTimeout(() => {
      if (this.data.categoryRecommendations.length === 0) {
        console.log('统一音乐管理器加载失败，使用备用方案');
        this.loadFallbackRecommendations();
      }
    }, 3000);
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
      let errorMessage = '获取音乐失败'
      let showModal = false
      let modalTitle = '提示'
      let showSwitchButton = false
      
      if (error.message) {
        if (error.message.includes('没有音乐资源') || error.message.includes('暂无可用内容')) {
          // 分类中没有音乐资源
          errorMessage = error.message
          modalTitle = '分类暂无内容'
          showModal = true
          showSwitchButton = true
        } else if (error.message.includes('音频正在更新中')) {
          errorMessage = error.message
          modalTitle = '音频更新中'
          showModal = true
          showSwitchButton = true
        } else if (error.message.includes('网络连接不稳定')) {
          errorMessage = error.message
          modalTitle = '网络问题'
          showModal = true
          showSwitchButton = false
        } else if (error.message.includes('音频URL无效') || error.message.includes('音频暂时无法访问')) {
          errorMessage = '音频文件暂时无法访问，请稍后再试'
          modalTitle = '音频加载失败'
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
   * 获取分类名称
   */
  getCategoryName: function(categoryId) {
    const category = this.data.categories.find(cat => cat.id === categoryId)
    return category ? category.name : '未知分类'
  },
  
  /**
   * 选择一个可用的分类
   */
  selectAvailableCategory: function() {
    // 默认选择分类1（自然音）或分类5（疗愈资源），这些通常有内容
    const fallbackCategories = [1, 5, 4]
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
      console.log('开始加载音乐分类...')
      const { MusicAPI } = require('../../utils/healingApi')
      
      // 从API获取分类数据
      const categoriesResult = await MusicAPI.getCategories().catch(error => {
        console.warn('获取分类API失败:', error)
        return { success: false, data: [] }
      })
      
      let categories = []
      
      if (categoriesResult.success && categoriesResult.data && categoriesResult.data.length > 0) {
        // 使用API返回的分类数据
        categories = categoriesResult.data.map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || cat.emoji_code || '🎵',
          description: cat.description || '音乐分类',
          count: cat.music_count || cat.count || 0
        }))
        console.log('从API加载分类成功:', categories.length)
      } else {
        // API失败时使用默认分类
        categories = this.getDefaultCategories()
        console.log('API失败，使用默认分类:', categories.length)
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
      wx.removeStorageSync('recommended_music_cache')
      wx.removeStorageSync('category_recommendations_cache')
      wx.removeStorageSync('personalized_recommendations_cache')
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
      
      // 重新初始化推荐数据
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
      
      // 1. 清理统一音乐管理器的缓存
      unifiedMusicManager.clearCache()
      
      // 2. 清理其他相关缓存
      wx.removeStorageSync('music_categories_cache')
      wx.removeStorageSync('category_recommendations_cache')
      
      console.log('已清理分类相关缓存')
      
      // 3. 强制重新从服务器获取分类数据
      this.loadMusicCategoriesFromServer().then(() => {
        wx.hideLoading()
        wx.showToast({
          title: '分类数据已更新',
          icon: 'success'
        })
        
        // 4. 重新加载推荐音乐
        if (this.data.selectedCategory) {
          this.loadCategoryRecommendations(this.data.selectedCategory)
        }
        
      }).catch(error => {
        wx.hideLoading()
        console.error('强制刷新分类失败:', error)
        wx.showToast({
          title: '刷新失败，请稍后重试',
          icon: 'none'
        })
      })
      
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
   * 直接从服务器加载分类数据（绕过缓存）
   */
  async loadMusicCategoriesFromServer() {
    try {
      console.log('强制从服务器加载音乐分类...')
      const { MusicAPI } = require('../../utils/healingApi')
      
      // 添加时间戳参数强制刷新
      const timestamp = Date.now()
      const categoriesResult = await MusicAPI.getCategories()
      
      if (categoriesResult.success && categoriesResult.data && categoriesResult.data.length > 0) {
        // 使用API返回的最新分类数据
        const categories = categoriesResult.data.map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || cat.emoji_code || '🎵',
          description: cat.description || '音乐分类',
          count: cat.music_count || cat.count || 0,
          updated_at: timestamp // 添加更新时间戳
        }))
        
        this.setData({
          categories: categories
        })
        
        console.log(`从服务器强制加载分类成功: ${categories.length} 个分类`)
        
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
   * 获取默认分类（降级处理）
   */
  getDefaultCategories() {
    return [
      { 
        id: 1, 
        name: '自然音', 
        icon: '🌿',
        description: '大自然的真实声音',
        count: 1
      },
      { 
        id: 2, 
        name: '白噪音', 
        icon: '🔊',
        description: '各种频率的白噪音',
        count: 1
      },
      { 
        id: 4, 
        name: 'AI音乐', 
        icon: '🤖',
        description: 'AI生成的个性化音乐',
        count: 1
      },
      { 
        id: 5, 
        name: '疗愈资源', 
        icon: '💚',
        description: '专业的疗愈资源',
        count: 1
      }
    ]
  },

  /**
   * 加载推荐音乐
   */
  loadRecommendedMusic: function() {
    console.log('loadRecommendedMusic调用:', {
      isLoggedIn: this.data.isLoggedIn,
      userInfo: this.data.userInfo
    })
    
    if (!this.data.isLoggedIn || !this.data.userInfo) {
      console.log('用户未登录，跳过推荐音乐加载')
      return
    }
    
    try {
      // 更安全地获取用户ID，支持多种字段名
      const userInfo = this.data.userInfo
      const userId = userInfo.id || userInfo.user_id || userInfo.userId
      
      console.log('用户信息详细:', {
        userInfo: userInfo,
        userId: userId,
        availableFields: Object.keys(userInfo || {})
      })
      
      if (!userId) {
        console.warn('用户ID为空，无法加载推荐音乐:', userInfo)
        return
      }
      
      console.log('开始获取推荐音乐，userId:', userId)
      this.getPersonalizedRecommendations(userId)
    } catch (error) {
      console.error('加载推荐音乐失败:', error)
    }
  },
  
  /**
   * 获取个性化推荐
   */
  async getPersonalizedRecommendations(userId) {
    try {
      // 使用智能推荐引擎获取个性化推荐
      const recommendations = await recommendationEngine.getPersonalizedRecommendations(userId, 6);
      
      this.setData({
        recommendedMusic: recommendations
      });
      
      console.log('智能推荐音乐加载完成:', {
        count: recommendations.length,
        isLoggedIn: this.data.isLoggedIn,
        userInfo: this.data.userInfo,
        recommendations: recommendations
      });
      
    } catch (error) {
      console.error('获取个性化推荐失败:', error);
      this.setData({
        recommendedMusic: []
      });
    }
  },
  
  // 推荐相关方法已移至 recommendationEngine.js
  
  /**
   * 点击推荐音乐
   */
  onRecommendedMusicTap: function(e) {
    const music = e.currentTarget.dataset.music
    console.log('点击推荐音乐:', music.title)
    
    this.setData({
      currentRecommendedId: music.id
    })
    
    // 使用全局播放器播放推荐的音乐
    this.playRecommendationWithGlobalPlayer(music)
  },
  
  /**
   * 显示我的音乐库
   */
  showMyMusicLibrary: function() {
    wx.switchTab({
      url: '/pages/music/library/library'
    })
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
      if (sound.category === '自然音') {
        brainwaveInfo.baseFreq = '8-15';
        brainwaveInfo.beatFreq = '10';
      } else if (sound.category === '白噪音') {
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
        case 1: // 自然音
        case 2: // 白噪音
        case 4: // AI音乐
        case 5: // 疗愈资源
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
  
  showAllRecommended: function () {
    wx.navigateTo({
      url: '/pages/sounds/sounds?type=recommended&mood=' + this.data.selectedMood
    });
  },
  
  onSearch: function (e) {
    const keyword = e.detail.value;
    if (!keyword) return;
    
    const results = soundData.searchSounds(keyword);
    this.setData({
      sounds: results
    });
  },
  
  loadSoundData: function() {
    // 不再需要预加载静态声音数据
    // 统一音乐管理器会按需获取
    console.log('统一音乐管理器已接管音乐数据加载');
  },
  
  // 搜索功能
  onSearch: function(e) {
    const keyword = e.detail.value;
    if (keyword && keyword.trim()) {
      wx.navigateTo({
        url: `/pages/search/search?keyword=${encodeURIComponent(keyword.trim())}`
      });
    }
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
      isPlaying: false,
      playProgress: 0
    })
    console.log('关闭全局播放器')
  },

  // 静态波形点击跳转处理
  onWaveformSeek(e) {
    const { progress } = e.detail
    console.log('首页波形跳转请求:', progress + '%')
    
    // 触发全局播放器的跳转事件
    this.triggerEvent('seek', { progress })
    
    // 或者通过全局播放器组件引用直接调用
    const globalPlayer = this.selectComponent('#global-player')
    if (globalPlayer) {
      globalPlayer.seekToProgress(progress)
    }
  },

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
        category_name: sound.category || '未知分类',
        play_duration: actualPlayDuration,
        total_duration: this.currentPlayRecord.totalDuration,
        play_progress: playProgress,
        device_type: 'miniprogram',
        play_source: 'homepage'
      };

      console.log('记录播放结束:', playRecordData);

      // 调用API记录播放记录
      const api = require('../../utils/api');
      api.request({
        url: '/play-records/',
        method: 'POST',
        data: playRecordData,
        showLoading: false
      }).then((result) => {
        if (result.success) {
          console.log('播放记录创建成功:', result.data.id);
        } else {
          console.warn('播放记录创建失败:', result.error);
        }
      }).catch((error) => {
        console.error('创建播放记录失败:', error);
      });

      // 清除当前播放记录
      this.currentPlayRecord = null;

    } catch (error) {
      console.error('记录播放结束失败:', error);
    }
  }
});
