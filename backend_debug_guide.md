# 订单创建接口500错误调试指南

## 问题描述
`/subscription/create-order` 接口返回500错误，而其他接口正常工作。

## 小程序端状态（已确认正常）
- ✅ 参数格式：plan_id(string), user_id(string), payment_config(object)
- ✅ 认证：Token有效，认证头正确
- ✅ 网络：连接正常，其他API工作正常
- ✅ 数据：所有必需字段都存在且格式正确

## 后端需要检查的问题

### 1. 服务器日志检查
```bash
# 检查订单创建接口的错误日志
tail -f /var/log/nginx/error.log
tail -f /var/log/your-app/error.log
# 查找包含 "create-order" 或 "subscription" 的500错误
```

### 2. 数据库连接检查
```bash
# 检查数据库连接是否正常
# 检查subscription_plans表是否存在
# 检查payment_orders表是否存在且可写
```

### 3. 支付服务检查
```bash
# 检查微信支付API配置
# 验证支付API Key是否正确
# 检查支付服务是否可达
```

### 4. 具体参数测试
请使用以下参数测试后端接口：
```json
{
  "plan_id": "premium_monthly",
  "user_id": "93",
  "payment_config": {
    "api_key": "zlkjcy19811031Medmedvaultcnsleep",
    "app_id": "wxd0f3dc2792ca55fb", 
    "timeout": 300000
  }
}
```

### 5. 可能的问题点
1. **plan_id验证** - 检查"premium_monthly"是否在数据库中存在
2. **用户权限** - 检查用户ID 93是否有订阅权限
3. **支付配置** - 检查payment_config处理逻辑
4. **第三方服务** - 检查微信支付API调用是否超时
5. **数据库写入** - 检查订单表是否有写入权限问题
6. **内存/资源** - 检查服务器资源是否充足

### 6. 建议的修复步骤
1. 先查看详细的500错误日志
2. 确认plan_id="premium_monthly"在数据库中存在
3. 检查支付API配置和连通性
4. 验证数据库表结构和权限
5. 添加更详细的错误日志记录

## 测试命令
```bash
# 使用有效token测试（需要替换为真实的token）
curl -X POST https://medsleep.cn/api/subscription/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{"plan_id":"premium_monthly","user_id":"93","payment_config":{"api_key":"zlkjcy19811031Medmedvaultcnsleep","app_id":"wxd0f3dc2792ca55fb","timeout":300000}}'
```

## 结论
这是典型的服务器端500错误，小程序端的参数和配置都是正确的。问题出在后端服务的订单处理逻辑中。
