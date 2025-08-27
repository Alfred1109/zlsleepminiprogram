# 真机调试检查清单

## 1. 域名白名单配置检查

### 小程序管理后台配置
登录微信小程序管理后台，检查以下域名是否已配置：

**request合法域名：**
- [ ] `https://medsleep.cn`

**downloadFile合法域名：**
- [ ] `https://medsleep.cn`

**uploadFile合法域名：**
- [ ] `https://medsleep.cn`

### 配置步骤
1. 登录微信小程序管理后台
2. 进入"开发" -> "开发管理" -> "开发设置"
3. 在"服务器域名"部分添加上述域名
4. 保存配置
5. 重新发布小程序

## 2. 开发工具配置检查

### 本地调试设置
- [ ] 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"
- [ ] 确保使用真机调试模式

## 3. 网络请求检查

### API地址验证
- [ ] 确认API地址：`https://medsleep.cn/api`
- [ ] 确认登录接口：`https://medsleep.cn/api/auth/account-login`
- [ ] 测试账号：`test` / `123456`

### 网络连接测试
```bash
# 测试API连接
curl -X POST https://medsleep.cn/api/auth/account-login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

## 4. 环境检测检查

### 真机环境检测
- [ ] 确认环境检测正确识别真机环境
- [ ] 确认使用生产服务器地址
- [ ] 检查控制台日志中的API配置

### 预期日志
```
环境检测信息: {appId: "wxd0f3dc2792ca55fb", envVersion: "develop", version: ""}
检测到真机环境，使用生产配置
当前API配置: {env: {...}, baseUrl: "https://medsleep.cn/api", timestamp: "..."}
```

## 5. 常见错误排查

### SSL证书错误
- 错误信息：`ERR_SSL_PROTOCOL_ERROR`
- 解决方案：确认使用443端口HTTPS

### 域名未配置错误
- 错误信息：`request:fail domain not allowed`
- 解决方案：在小程序管理后台配置域名白名单

### 网络连接错误
- 错误信息：`ERR_CONNECTION_REFUSED`
- 解决方案：检查服务器是否正常运行

### 请求超时错误
- 错误信息：`request:fail timeout`
- 解决方案：检查网络连接，增加超时时间

## 6. 调试步骤

### 步骤1：检查域名配置
1. 确认小程序管理后台已配置域名白名单
2. 重新发布小程序

### 步骤2：检查网络请求
1. 在真机调试时查看控制台日志
2. 确认API地址正确
3. 检查网络请求是否成功

### 步骤3：检查环境检测
1. 确认环境检测逻辑正确
2. 确认使用正确的API地址

### 步骤4：测试登录
1. 输入测试账号：`test` / `123456`
2. 勾选用户协议和隐私政策
3. 点击登录按钮
4. 查看错误信息

## 7. 联系信息

如果问题仍然存在，请提供以下信息：
- 具体的错误信息
- 控制台日志
- 网络请求详情
- 小程序版本信息
