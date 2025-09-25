// 用户信息更新示例
// 展示如何使用新的 sync_username 功能
// -------------------------------------------

const AuthService = require('../services/AuthService')
const { UserAPI } = require('./healingApi')

/**
 * 通用用户信息更新方法
 * 支持昵称更新和用户名自动同步
 * 
 * @param {Object} options - 更新选项
 * @param {string} options.nickname - 新昵称
 * @param {boolean} [options.syncUsername=true] - 是否启用用户名同步
 * @param {string} [options.avatarUrl] - 用户头像URL
 * @returns {Promise<Object>} - 更新结果
 */
async function updateUserInfoWithSync(options = {}) {
  try {
    const { nickname, syncUsername = true, avatarUrl } = options
    
    // 获取当前用户信息
    const userInfo = AuthService.getCurrentUser()
    if (!userInfo || !userInfo.id) {
      throw new Error('用户未登录或用户信息无效')
    }

    // 获取token
    const token = AuthService.getAccessToken()
    if (!token) {
      throw new Error('未找到访问令牌')
    }

    // 准备更新数据
    const updateData = {
      user_id: userInfo.id,
      sync_username: syncUsername
    }

    if (nickname) {
      updateData.nickname = nickname
    }

    if (avatarUrl) {
      updateData.avatar_url = avatarUrl
    }

    console.log('🔄 开始更新用户信息:', updateData)

    // 方式1：使用项目现有的 UserAPI
    const result = await UserAPI.updateUserInfo(updateData)

    if (result && result.success) {
      console.log('✅ 用户信息更新成功')
      
      // 处理警告信息
      if (result.warnings && result.warnings.length > 0) {
        console.warn('⚠️ 更新时收到警告:', result.warnings)
        // 在实际应用中，您可以显示这些警告给用户
      }

      // 刷新本地用户信息
      const refreshedUserInfo = await AuthService.refreshUserInfo()
      
      return {
        success: true,
        data: refreshedUserInfo || result.data,
        warnings: result.warnings
      }
    } else {
      throw new Error(result?.message || '更新失败')
    }

  } catch (error) {
    console.error('❌ 更新用户信息失败:', error)
    throw error
  }
}

/**
 * 按照您提供的格式使用 wx.request 直接调用API
 * （仅作为示例，实际项目中建议使用上面的 updateUserInfoWithSync 方法）
 */
async function updateUserInfoDirectly(nickname) {
  try {
    const userInfo = AuthService.getCurrentUser()
    const token = AuthService.getAccessToken()
    
    if (!userInfo || !token) {
      throw new Error('用户未登录')
    }

    // 获取API基础URL
    const app = getApp()
    const apiBaseUrl = app.globalData.apiBaseUrl || 'https://medsleep.cn'

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBaseUrl}/api/auth/user/update`,
        method: 'PUT',
        header: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: {
          user_id: userInfo.id,
          nickname: nickname,
          sync_username: true  // 启用自动同步
        },
        success: function(res) {
          if (res.data.success) {
            console.log('昵称更新成功，用户名已同步')
            
            // 如果有警告信息（如用户名冲突）
            if (res.data.warnings) {
              console.warn('警告：', res.data.warnings)
              // 显示警告给用户
              wx.showModal({
                title: '温馨提示',
                content: res.data.warnings.join('\n'),
                showCancel: false,
                confirmText: '我知道了'
              })
            }
            
            // 刷新本地用户信息
            AuthService.refreshUserInfo().then(() => {
              resolve(res.data)
            }).catch(error => {
              console.warn('刷新用户信息失败:', error)
              resolve(res.data)
            })
          } else {
            reject(new Error(res.data.message || '更新失败'))
          }
        },
        fail: function(error) {
          reject(error)
        }
      })
    })
  } catch (error) {
    console.error('❌ 直接更新用户信息失败:', error)
    throw error
  }
}

/**
 * 使用示例
 */
const examples = {
  // 示例1：更新昵称并同步用户名
  async updateNickname() {
    try {
      const result = await updateUserInfoWithSync({
        nickname: '用户新昵称',
        syncUsername: true
      })
      
      console.log('更新结果:', result)
      wx.showToast({ 
        title: '昵称更新成功', 
        icon: 'success' 
      })
    } catch (error) {
      wx.showToast({ 
        title: error.message, 
        icon: 'none' 
      })
    }
  },

  // 示例2：只更新昵称，不同步用户名
  async updateNicknameOnly() {
    try {
      const result = await updateUserInfoWithSync({
        nickname: '仅更新昵称',
        syncUsername: false
      })
      
      console.log('更新结果:', result)
    } catch (error) {
      console.error('更新失败:', error)
    }
  },

  // 示例3：同时更新昵称和头像
  async updateProfileComplete() {
    try {
      const result = await updateUserInfoWithSync({
        nickname: '完整资料更新',
        avatarUrl: 'https://example.com/avatar.jpg',
        syncUsername: true
      })
      
      console.log('更新结果:', result)
    } catch (error) {
      console.error('更新失败:', error)
    }
  },

  // 示例4：使用您提供的格式
  async useDirectMethod() {
    try {
      const result = await updateUserInfoDirectly('直接API调用')
      console.log('直接调用结果:', result)
    } catch (error) {
      console.error('直接调用失败:', error)
    }
  }
}

module.exports = {
  updateUserInfoWithSync,
  updateUserInfoDirectly,
  examples
}
