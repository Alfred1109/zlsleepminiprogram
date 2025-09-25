const productApi = require('../../../utils/productApi')

Page({
  data: {
    addressList: [],
    loading: true,
    isManageMode: false,
    selectedAddresses: []
  },

  onLoad(options) {
    console.log('地址列表页面参数:', options)
    this.loadAddressList()
  },

  onShow() {
    // 从其他页面返回时刷新地址列表
    this.loadAddressList()
  },

  // 加载地址列表
  async loadAddressList() {
    this.setData({ loading: true })
    
    try {
      const response = await productApi.getAddressList()
      
      if (response.success) {
        this.setData({
          addressList: response.data || []
        })
      } else {
        throw new Error(response.error || '加载地址列表失败')
      }
    } catch (error) {
      console.error('加载地址列表失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 添加新地址
  addNewAddress() {
    wx.navigateTo({
      url: '/pages/address/edit/edit?mode=create'
    })
  },

  // 编辑地址
  editAddress(e) {
    const addressId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/address/edit/edit?mode=edit&id=${addressId}`
    })
  },

  // 设置默认地址
  async setDefaultAddress(e) {
    const addressId = e.currentTarget.dataset.id
    
    try {
      wx.showLoading({
        title: '设置中...',
        mask: true
      })
      
      const response = await productApi.setDefaultAddress(addressId)
      
      if (response.success) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        })
        
        // 更新本地数据
        const addressList = this.data.addressList.map(addr => ({
          ...addr,
          isDefault: addr.id === addressId
        }))
        
        this.setData({ addressList })
      } else {
        throw new Error(response.error || '设置失败')
      }
    } catch (error) {
      console.error('设置默认地址失败:', error)
      wx.showToast({
        title: error.message || '设置失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 删除地址
  deleteAddress(e) {
    const addressId = e.currentTarget.dataset.id
    const address = this.data.addressList.find(addr => addr.id === addressId)
    
    if (!address) return
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除地址"${address.name} ${address.phone}"吗？`,
      confirmText: '删除',
      confirmColor: '#FF6B35',
      success: (res) => {
        if (res.confirm) {
          this.performDeleteAddress(addressId)
        }
      }
    })
  },

  // 执行删除地址
  async performDeleteAddress(addressId) {
    try {
      wx.showLoading({
        title: '删除中...',
        mask: true
      })
      
      const response = await productApi.deleteAddress(addressId)
      
      if (response.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        // 从本地数据中移除
        const addressList = this.data.addressList.filter(addr => addr.id !== addressId)
        this.setData({ addressList })
      } else {
        throw new Error(response.error || '删除失败')
      }
    } catch (error) {
      console.error('删除地址失败:', error)
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换管理模式
  toggleManageMode() {
    this.setData({
      isManageMode: !this.data.isManageMode,
      selectedAddresses: []
    })
  },

  // 选择地址（管理模式）
  toggleAddressSelection(e) {
    if (!this.data.isManageMode) return
    
    const addressId = e.currentTarget.dataset.id
    const selectedAddresses = [...this.data.selectedAddresses]
    const index = selectedAddresses.indexOf(addressId)
    
    if (index > -1) {
      selectedAddresses.splice(index, 1)
    } else {
      selectedAddresses.push(addressId)
    }
    
    this.setData({ selectedAddresses })
  },

  // 批量删除地址
  batchDeleteAddresses() {
    const { selectedAddresses, addressList } = this.data
    
    if (selectedAddresses.length === 0) {
      wx.showToast({
        title: '请选择要删除的地址',
        icon: 'none'
      })
      return
    }
    
    const addressNames = selectedAddresses
      .map(id => addressList.find(addr => addr.id === id))
      .filter(Boolean)
      .map(addr => `${addr.name} ${addr.phone}`)
      .join('、')
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除以下地址吗？\n${addressNames}`,
      confirmText: '删除',
      confirmColor: '#FF6B35',
      success: (res) => {
        if (res.confirm) {
          this.performBatchDelete()
        }
      }
    })
  },

  // 执行批量删除
  async performBatchDelete() {
    const { selectedAddresses } = this.data
    
    try {
      wx.showLoading({
        title: '删除中...',
        mask: true
      })
      
      // 并行删除所有选中的地址
      const deletePromises = selectedAddresses.map(addressId => 
        productApi.deleteAddress(addressId)
      )
      
      const results = await Promise.allSettled(deletePromises)
      
      // 检查删除结果
      const failedCount = results.filter(result => 
        result.status === 'rejected' || !result.value?.success
      ).length
      
      if (failedCount === 0) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: `${selectedAddresses.length - failedCount}个删除成功，${failedCount}个删除失败`,
          icon: 'none'
        })
      }
      
      // 刷新地址列表
      this.loadAddressList()
      
      // 退出管理模式
      this.setData({
        isManageMode: false,
        selectedAddresses: []
      })
      
    } catch (error) {
      console.error('批量删除地址失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { addressList, selectedAddresses } = this.data
    
    if (selectedAddresses.length === addressList.length) {
      // 当前全选，取消全选
      this.setData({ selectedAddresses: [] })
    } else {
      // 当前非全选，设置全选
      this.setData({ 
        selectedAddresses: addressList.map(addr => addr.id) 
      })
    }
  },

  // 地址项点击事件
  onAddressItemTap(e) {
    if (this.data.isManageMode) {
      this.toggleAddressSelection(e)
    } else {
      // 非管理模式下，可以用于选择地址（如果是从其他页面跳转过来）
      const pages = getCurrentPages()
      if (pages.length > 1) {
        const prevPage = pages[pages.length - 2]
        if (prevPage.route.includes('order/create')) {
          // 如果是从订单创建页面跳转过来，可以选择地址返回
          const addressId = e.currentTarget.dataset.id
          const selectedAddress = this.data.addressList.find(addr => addr.id === addressId)
          
          if (selectedAddress) {
            // 通过 EventChannel 或其他方式传递选中的地址
            wx.navigateBack()
          }
        }
      }
    }
  }
})
