// 全局底部菜单栏组件
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示底部菜单栏
    visible: {
      type: Boolean,
      value: true
    },
    // 当前页面标识
    currentPage: {
      type: String,
      value: ''
    },
    // 主题类名
    themeClass: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 页面映射关系
    pageMapping: {
      'pages/index/index': 'index',
      'pages/assessment/scales/scales': 'assessment',
      'pages/assessment/questions/questions': 'assessment',
      'pages/assessment/result/result': 'assessment',
      'pages/music/library/library': 'music',
      'pages/music/category/category': 'music',
      'pages/music/generate/generate': 'music',
      'pages/music/player/player': 'music',
      'pages/profile/profile': 'profile',
      'pages/settings/settings': 'profile',
      'pages/favorites/favorites': 'profile',
      'pages/downloads/downloads': 'profile',
      'pages/subscription/subscription': 'profile',
      'pages/history/history': 'profile'
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 组件实例被创建时
      this.detectCurrentPage();
      this.initTheme();
    },
    
    ready() {
      // 组件布局完成后
      this.setGlobalTabbarReference();
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 检测当前页面
     */
    detectCurrentPage() {
      try {
        const pages = getCurrentPages();
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1];
          const route = currentPage.route;
          const pageType = this.data.pageMapping[route] || '';
          
          this.setData({
            currentPage: pageType
          });
          
          console.log('检测到当前页面:', route, '→', pageType);
        }
      } catch (error) {
        console.error('检测当前页面失败:', error);
      }
    },

    /**
     * 初始化主题
     */
    initTheme() {
      try {
        const app = getApp();
        const themeClass = app.globalData?.themeConfig?.class || '';
        this.setData({
          themeClass: themeClass
        });
      } catch (error) {
        console.error('初始化主题失败:', error);
      }
    },

    /**
     * 设置全局菜单栏引用
     */
    setGlobalTabbarReference() {
      try {
        const app = getApp();
        if (app.globalData) {
          app.globalData.globalTabbar = this;
        }
      } catch (error) {
        console.error('设置全局菜单栏引用失败:', error);
      }
    },

    /**
     * 导航到指定页面
     */
    navigateToPage(e) {
      const { page, url } = e.currentTarget.dataset;
      
      // 触觉反馈
      wx.vibrateShort({
        type: 'light'
      });

      // 如果是当前页面，不进行跳转
      if (this.data.currentPage === page) {
        console.log('已在当前页面，无需跳转');
        return;
      }

      try {
        // 获取当前页面栈
        const pages = getCurrentPages();
        const currentPagePath = pages.length > 0 ? pages[pages.length - 1].route : '';
        
        // 判断是否为主要页面（原tab页面）
        const mainPages = [
          'pages/index/index',
          'pages/assessment/scales/scales', 
          'pages/music/library/library',
          'pages/profile/profile'
        ];

        const targetPath = url.startsWith('/') ? url.substring(1) : url;
        const isMainPage = mainPages.includes(targetPath);
        const isCurrentMainPage = mainPages.includes(currentPagePath);

        if (isMainPage && isCurrentMainPage) {
          // 主要页面之间的跳转，使用redirectTo避免页面栈堆积
          wx.redirectTo({
            url: url,
            success: () => {
              console.log('主要页面跳转成功:', url);
              this.setData({
                currentPage: page
              });
            },
            fail: (error) => {
              console.error('主要页面跳转失败:', error);
              this.fallbackNavigate(url, page);
            }
          });
        } else if (isMainPage) {
          // 从普通页面跳转到主要页面，使用navigateTo
          wx.navigateTo({
            url: url,
            success: () => {
              console.log('跳转到主要页面成功:', url);
              this.setData({
                currentPage: page
              });
            },
            fail: (error) => {
              console.error('跳转到主要页面失败:', error);
              this.fallbackNavigate(url, page);
            }
          });
        } else {
          // 跳转到普通页面
          wx.navigateTo({
            url: url,
            success: () => {
              console.log('跳转到页面成功:', url);
              this.setData({
                currentPage: page
              });
            },
            fail: (error) => {
              console.error('跳转到页面失败:', error);
              this.fallbackNavigate(url, page);
            }
          });
        }
      } catch (error) {
        console.error('页面跳转异常:', error);
        this.fallbackNavigate(url, page);
      }
    },

    /**
     * 降级导航方式
     */
    fallbackNavigate(url, page) {
      try {
        wx.redirectTo({
          url: url,
          success: () => {
            console.log('降级跳转成功:', url);
            this.setData({
              currentPage: page
            });
          },
          fail: (error) => {
            console.error('降级跳转也失败:', error);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none',
              duration: 2000
            });
          }
        });
      } catch (error) {
        console.error('降级跳转异常:', error);
      }
    },

    /**
     * 更新当前页面状态
     */
    updateCurrentPage(route) {
      const pageType = this.data.pageMapping[route] || '';
      this.setData({
        currentPage: pageType
      });
      console.log('更新当前页面状态:', route, '→', pageType);
    },

    /**
     * 更新主题
     */
    updateTheme(themeClass) {
      this.setData({
        themeClass: themeClass || ''
      });
      console.log('更新底部菜单栏主题:', themeClass);
    },

    /**
     * 显示/隐藏底部菜单栏
     */
    setVisible(visible) {
      this.setData({
        visible: !!visible
      });
    }
  }
});
