## 架构总览

### 1. 应用结构
- **app.js / app.json**：初始化全局配置（API 域名、播放器实例、主题、用户信息），集中处理导航与全局事件。
- **页面分层**：
  - `pages/music/*`：核心脑波功能（生成、播放、库、分类）。
  - `pages/assessment/*`：心理评测流程与历史。
  - `pages/profile`、`pages/subscription`：用户与订阅管理。
  - 其余页面提供场景、设备、订单等辅助能力。
- **自定义组件**：`components/global-player`、`theme-switcher`、`global-tabbar`、波形组件等，封装跨页面复用的 UI 与交互逻辑。

### 2. 数据与服务层
- **API 封装**：
  - `utils/api.js` 统一 `wx.request`（鉴权、超时、错误处理）；`utils/apiClassifier.js`、`utils/responseFormatter.js` 提供接口分类与响应整理。
- **业务 Facade（utils/healingApi.js）**：
  - `MusicAPI`：统一脑波生成与状态轮询，深度脑波与快速脑波共享 `/api/music/generate-unified`。
  - `AssessmentAPI`、`SubscriptionAPI` 等负责其他业务域。
- **全局工具**：
  - `utils/musicPlayer.js` 封装 `BackgroundAudioManager`，支持流式播放、兜底重试、智能进度。
  - `sceneContextManager`、`sceneMappingService` 管理场景筛选。
  - `subscription`、`AuthService` 处理权限与登录。

### 3. 核心页面职责
- **生成页 `pages/music/generate`**
  - 统一脑波生成入口，支持多评测选择与时长（1~60 分钟）。
  - 短时生成直接返回；深度脑波触发智能进度、轮询 `MusicAPI.getMusicStatus`，完成后跳转播放器。
- **播放器 `pages/music/player`**
  - 与 `global-player` 协作播放；可识别深度脑波，展示 ISO 三阶段进度，自动处理流式 URL → 静态 URL 回退。
  - 收藏、下载、分享、播放列表等操作统一在此实现。
- **脑波库 `pages/music/library`**
  - 管理快速/深度脑波列表与收藏状态；所有播放入口跳转统一播放器。
  - 场景模式下通过 `sceneMappingService` 过滤数据。

### 4. 组件与交互
- **global-player**
  - 内置控制栏、进度、波形绑定；暴露 `playTrack`、`pauseTrack` 等方法供页面调用。
  - 接入 `utils/musicPlayer` 实现播放、流式检测、网络兜底。
- **波形组件**：实时/静态两种模式，监听 `audioContext` 更新图形。
- **主题/导航**：`theme-switcher`、`global-tabbar` 负责主题同步与底部导航。

### 5. 数据流转核心路径
1. 页面触发操作（生成/收藏/下载等）。
2. 通过服务层 (`MusicAPI`、`AssessmentAPI`) 调用后端；`utils/api` 统一发起请求并处理响应。
3. 接口结果存入页面 `data` 或全局状态，并驱动 UI 更新。
4. 播放流程：页面构造 `trackInfo` → `global-player.playTrack` → `utils/musicPlayer` 控制底层音频 → 事件回传给页面/组件更新状态。
5. 订阅校验：`requireSubscription` 拦截需要权限的操作，弹窗引导购买/试用。

### 6. 近期改造要点
- 统一快/深脑波流程：删除 `pages/longSequence/*`，将深度脑波生成、播放合入 `pages/music/*` 栈。
- 全局播放器支持流式播放 + 静态回退，并针对深度脑波显示 ISO 结构。
- 清理测试/调试页面与多余路由，保证配置简洁。

### 7. 可扩展方向
- 接入行为埋点/性能监控，持续观测生成与播放成功率。
- 根据 `MusicAPI` 返回的更多元数据（如情绪标签、推荐列表），扩展脑波库与推荐能力。
- 将通用逻辑抽至自定义 hook/模块，方便后续跨端复用。
