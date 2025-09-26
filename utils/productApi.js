/**
 * 实物商品相关API接口封装
 */

const { get, post, put, del } = require('./api')

/**
 * 商品相关API
 */

// 获取商品列表
function getProductList(params = {}) {
  return get('/api/physical-products/list', params)
}

// 获取商品详情
function getProductDetail(planId) {
  return get(`/api/physical-products/${planId}/detail`)
}

// 搜索商品
function searchProducts(keyword, params = {}) {
  return get('/api/physical-products/search', { keyword, ...params })
}

// 获取商品分类
function getProductCategories() {
  return get('/api/physical-products/categories')
}

/**
 * 订单相关API
 */

// 创建订单
function createOrder(orderData) {
  return post('/api/physical-products/create-order', orderData)
}

// 获取订单详情
function getOrderDetail(orderId) {
  return get(`/api/physical-products/orders/${orderId}`)
}

// 获取订单列表
function getOrderList(params = {}) {
  return get('/api/physical-products/orders', params)
}

// 取消订单
function cancelOrder(orderId) {
  return post(`/api/physical-products/orders/${orderId}/cancel`)
}

// 确认收货
function confirmOrder(orderId) {
  return post(`/api/physical-products/orders/${orderId}/confirm`)
}

/**
 * 地址相关API
 */

// 获取地址列表
function getAddressList() {
  return get('/api/physical-products/addresses')
}

// 获取地址详情
function getAddressDetail(addressId) {
  return get(`/api/physical-products/addresses/${addressId}`)
}

// 添加地址
function addAddress(addressData) {
  return post('/api/physical-products/addresses', addressData)
}

// 更新地址
function updateAddress(addressId, addressData) {
  return put(`/api/physical-products/addresses/${addressId}`, addressData)
}

// 删除地址
function deleteAddress(addressId) {
  return del(`/api/physical-products/addresses/${addressId}`)
}

// 设置默认地址
function setDefaultAddress(addressId) {
  return post(`/api/physical-products/addresses/${addressId}/set-default`)
}

/**
 * 支付相关API
 */

// 获取支付参数
function getPaymentParams(orderId) {
  return post(`/api/physical-products/orders/${orderId}/pay`)
}

// 查询支付状态
function getPaymentStatus(orderId) {
  return get(`/api/physical-products/orders/${orderId}/payment-status`)
}

/**
 * 配送相关API
 */

// 获取配送方式列表
function getDeliveryMethods() {
  return get('/api/physical-products/delivery-methods')
}

// 计算配送费用
function calculateDeliveryFee(addressId, productItems) {
  return post('/api/physical-products/calculate-delivery', {
    addressId,
    items: productItems
  })
}

// 获取物流信息
function getLogisticsInfo(orderId) {
  return get(`/api/physical-products/orders/${orderId}/logistics`)
}

/**
 * 优惠券相关API
 */

// 获取用户可用优惠券
function getAvailableCoupons(orderAmount = 0) {
  const params = orderAmount > 0 ? { amount: orderAmount } : {}
  return get('/api/count-package/coupon/available', params)
}

// 验证优惠券
function validateCoupon(couponCode) {
  return post('/api/count-package/coupon/validate', { code: couponCode })
}

// 兑换优惠券（用于订阅页面）
function redeemCoupon(couponCode) {
  return post('/api/count-package/coupon/redeem', { code: couponCode })
}

module.exports = {
  // 商品相关
  getProductList,
  getProductDetail,
  searchProducts,
  getProductCategories,
  
  // 订单相关
  createOrder,
  getOrderDetail,
  getOrderList,
  cancelOrder,
  confirmOrder,
  
  // 地址相关
  getAddressList,
  getAddressDetail,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  
  // 支付相关
  getPaymentParams,
  getPaymentStatus,
  
  // 配送相关
  getDeliveryMethods,
  calculateDeliveryFee,
  getLogisticsInfo,
  
  // 优惠券相关
  getAvailableCoupons,
  validateCoupon,
  redeemCoupon
}
