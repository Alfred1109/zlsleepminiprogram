// 七牛云统一架构管理器 - 纯API调用版本
const { getApiBaseUrl } = require('./config');

/**
 * 七牛云统一管理器类
 * 所有七牛云操作通过后台API统一管理
 */
class QiniuManagerUnified {
  constructor() {
    this.apiBase = '';
    this.initApiBase();
  }

  /**
   * 初始化API基础地址
   */
  initApiBase() {
    try {
      this.apiBase = getApiBaseUrl();
      console.log('七牛云统一管理器初始化，API地址:', this.apiBase);
    } catch (e) {
      console.error('获取API地址失败:', e);
      this.apiBase = 'https://medsleep.cn';
    }
  }

  /**
   * 按分类获取七牛云文件列表
   * @param {string} category - 分类名称 (sleep, relax, focus, 等)
   * @param {object} options - 选项
   * @returns {Promise<Array>} 文件列表
   */
  async getFilesByCategory(category, options = {}) {
    const { showLoading = true } = options;
    
    try {
      if (showLoading) {
        wx.showLoading({ title: '获取文件列表...' });
      }

      const response = await this.makeRequest({
        url: `${this.apiBase}/music/qiniu/categories/${category}/files`,
        method: 'GET'
      });

      if (showLoading) {
        wx.hideLoading();
      }

      if (response.success) {
        const files = response.data.files || [];
        console.log(`获取分类 ${category} 文件成功:`, files.length, '个文件');
        return files;
      } else {
        throw new Error(response.error || '获取文件列表失败');
      }
    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }
      console.error(`获取分类 ${category} 文件失败:`, error);
      throw error;
    }
  }

  /**
   * 随机获取分类音频
   * @param {string} category - 分类名称
   * @param {object} options - 选项
   * @returns {Promise<object>} 音频对象
   */
  async getRandomAudioByCategory(category, options = {}) {
    const { showLoading = true } = options;
    
    try {
      if (showLoading) {
        wx.showLoading({ title: '获取随机音频...' });
      }

      const response = await this.makeRequest({
        url: `${this.apiBase}/music/qiniu/random/${category}`,
        method: 'GET'
      });

      if (showLoading) {
        wx.hideLoading();
      }

      if (response.success) {
        console.log(`随机获取分类 ${category} 音频成功:`, response.data.name);
        return response.data;
      } else {
        throw new Error(response.error || '获取随机音频失败');
      }
    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }
      console.error(`随机获取分类 ${category} 音频失败:`, error);
      throw error;
    }
  }

  /**
   * 批量生成签名URL
   * @param {Array<string>} fileKeys - 文件键数组
   * @param {number} expiresIn - 过期时间（秒）
   * @returns {Promise<Array>} 签名结果数组
   */
  async getBatchSignedUrls(fileKeys, expiresIn = 7200) {
    try {
      wx.showLoading({ title: '生成签名URL...' });

      const response = await this.makeRequest({
        url: `${this.apiBase}/music/qiniu/batch_signed_urls`,
        method: 'POST',
        data: {
          file_keys: fileKeys,
          expires_in: expiresIn
        }
      });

      wx.hideLoading();

      if (response.success) {
        console.log('批量生成签名URL成功:', response.data.success_count, '/', response.data.total);
        return response.data.results;
      } else {
        throw new Error(response.error || '批量生成签名URL失败');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('批量生成签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 生成单个文件的签名URL（兼容旧接口）
   * @param {string} filePath - 文件路径
   * @param {number} expiresIn - 过期时间（秒）
   * @returns {Promise<string>} 签名URL
   */
  async getSignedUrl(filePath, expiresIn = 7200) {
    try {
      const response = await this.makeRequest({
        url: `${this.apiBase}/music/qiniu_signed_url`,
        method: 'POST',
        data: {
          file_path: filePath,
          expires_in: expiresIn
        }
      });

      if (response.success) {
        console.log('生成签名URL成功:', filePath);
        return response.data.signed_url;
      } else {
        throw new Error(response.error || '生成签名URL失败');
      }
    } catch (error) {
      console.error('生成签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 发起网络请求
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 响应数据
   */
  makeRequest(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        header: {
          'Content-Type': 'application/json',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.data?.error || '请求失败'}`));
          }
        },
        fail: (err) => {
          reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`));
        }
      });
    });
  }

  /**
   * 兼容旧接口：获取自然音列表
   * @param {Function} callback - 回调函数
   */
  async fetchNaturalSounds(callback) {
    try {
      const files = await this.getFilesByCategory('sleep');
      // 转换为旧格式
      const sounds = files.map(file => ({
        id: file.id,
        name: file.name,
        path: file.url,
        image: '/assets/images/default-image.png',
        category: '自然音',
        type: 'natural'
      }));
      callback(sounds);
    } catch (error) {
      console.error('获取自然音列表失败:', error);
      callback([]);
    }
  }

  /**
   * 兼容旧接口：获取随机自然音
   * @param {Function} callback - 回调函数
   */
  async getRandomNaturalSound(callback) {
    try {
      const audio = await this.getRandomAudioByCategory('sleep');
      // 转换为旧格式
      const sound = {
        id: audio.id,
        name: audio.name,
        path: audio.url,
        image: '/assets/images/default-image.png',
        category: '自然音',
        type: 'natural'
      };
      callback(sound);
    } catch (error) {
      console.error('获取随机自然音失败:', error);
      callback(null);
    }
  }

  /**
   * 兼容旧接口：获取指定目录文件列表
   * @param {string} directory - 目录路径（会根据映射转换为分类名）
   * @param {Function} callback - 回调函数
   */
  async fetchFileListFromDirectory(directory, callback) {
    try {
      // 目录路径到分类名的映射
      const dirToCategory = {
        'zl-sleep/': 'sleep',
        'zl-relax/': 'relax',
        'zl-focus/': 'focus',
        '': 'sleep' // 默认
      };

      const category = dirToCategory[directory] || 'sleep';
      const files = await this.getFilesByCategory(category);

      // 转换为旧格式
      const sounds = files.map(file => ({
        id: file.id,
        name: file.name,
        path: file.url,
        image: '/assets/images/default-image.png',
        category: file.category || '自然音',
        type: 'natural'
      }));

      callback(sounds);
    } catch (error) {
      console.error('获取目录文件列表失败:', error);
      callback([]);
    }
  }
}

// 创建单例实例
const qiniuManagerUnified = new QiniuManagerUnified();

module.exports = {
  // 导出统一管理器实例
  qiniuManagerUnified,
  
  // 导出兼容旧接口的方法
  getFileUrl: (filename) => {
    console.warn('getFileUrl已废弃，请使用统一管理器API');
          return `https://cdn.medsleep.cn/${filename}`;
  },
  
  fetchNaturalSounds: (callback) => {
    qiniuManagerUnified.fetchNaturalSounds(callback);
  },
  
  getRandomNaturalSound: (callback) => {
    qiniuManagerUnified.getRandomNaturalSound(callback);
  },
  
  fetchFileListFromDirectory: (directory, callback) => {
    qiniuManagerUnified.fetchFileListFromDirectory(directory, callback);
  },
  
  generatePrivateUrl: async (baseUrl) => {
    console.warn('generatePrivateUrl已废弃，请使用统一管理器API');
    try {
      // 从baseUrl提取文件路径
      const urlParts = baseUrl.split('/');
      if (urlParts.length >= 4) {
        const filePath = urlParts.slice(3).join('/');
        return await qiniuManagerUnified.getSignedUrl(filePath);
      }
    } catch (e) {
      console.error('URL签名失败:', e);
    }
    return baseUrl;
  },
  
  isTokenExpired: (url) => {
    // 简化实现：如果URL没有token参数，认为需要更新
    return !url.includes('token=');
  },
  
  // 兼容旧config导出
  config: {
    uri: 'cdn.medsleep.cn',
    bucket: 'zlhealing'
  }
};
