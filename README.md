# maimai.js

🔥 **maimai.js** 是一个将广受欢迎的 Python 库 [maimai.py](https://github.com/TrueRou/maimai.py) **完全移植为 JavaScript/TypeScript 的同构库**。它同样可以用来轻松实现 maimai DX 查分工具，获取玩家数据、谱面数据或分数。

## 特性

- **全协议支持** —— 与 `maimai.py` 一致，原生支持 LXNS、DivingFish、Wahlap (微信公众号) 获取玩家分数、卡牌等详细信息！
- **同构设计** —— 支持原生浏览器环境和 Node.js 环境执行，支持直接导入本地 JSON 获取本地离线缓存支持，免去文件系统读写问题，原生支持各大前端框架和脚手架。
- **现代化架构** —— 原生 `Promise` 操作结合轻量级内置缓存驱动基于 `lru-cache`。利用原生 `fetch` API 提供流畅访问网络接口的能力，摒弃厚重的依赖。
- **完全类型安全** —— 采用 TypeScript 编写，每个字段附带严格接口规范和静态检查，无需查阅文档即可通过代码推断享受完美的数据访问开发体验！

> **致谢**: 感谢 [@TrueRou](https://github.com/TrueRou) 与 maimai.py 的开源设计与数据抽象模型，本项目的逻辑结构基本一一对应原仓库，实现难度大幅度降低。

## 安装指南

建议使用 npm 或是同类包管理器进行安装：

```bash
npm install maimai.js
```

## 功能对比

| 接口 (Provider) | 模块导入方法 | 在 `maimai.js` 的状态 | 注解与说明 |
| -------------- | ----------- | ----------------- | --------------- |
| LXNS (水图) | `LXNSProvider` | 🟢 全部完成 | 主要基础支持 |
| DivingFish (落雪)| `DivingFishProvider` | 🟢 全部完成 | - |
| Wechat (微信公众号)| `WechatProvider` | 🟢 全部完成 | - |
| Yuzu | `YuzuProvider` | 🟢 全部完成 | 提供别名词典支持 |
| Local | `LocalProvider` | 🟢 全部完成 | 读取本地附属文件数据 |
| Arcade (街机 FFI)| `ArcadeProvider` | 🔴 拒绝移植 | 依赖闭源的私有打包组件 `maimai_ffi` |

## 快速使用

以下是查询玩家基本数据的通用代码示例：

```javascript
import { MaimaiClient, PlayerIdentifier, LXNSProvider } from 'maimai.js';

const client = new MaimaiClient();

// 通过 LXNS 获得一位玩家的游玩卡片数据与分数
async function testLXNS() {
    const ident = new PlayerIdentifier({ qq: 114514 });
    const player = await client.players(ident, new LXNSProvider('your-developer-token'));
    
    console.log(`User name: ${player.name}, rating: ${player.rating}`);
    
    const scores = await client.bests(ident, new LXNSProvider('your-developer-token'));
    console.log(`DX Rating b50: ${scores.rating}`);
}

testLXNS();
```

通过微信数据网页获取记录：

```javascript
import { MaimaiClient, WechatProvider, PlayerIdentifier } from 'maimai.js';

const client = new MaimaiClient();

async function fromWechat() {
    // 假设您已经获取到了 Wahlap 的 Cookies！
    const ident = new PlayerIdentifier({ credentials: 'you-cookies-session' });
    const records = await client.records(ident, new WechatProvider());

    records.forEach(r => {
        console.log(`游玩时间: ${r.play_time}, 谱面大区: ${r.type}, 成绩: ${r.achievements}`);
    });
}
```

注意：由于街机通信获取 QR 代码模块涉及到闭源 Python C++ FFI `maimai-ffi`，目前在 JS 暂不支持自动生成 QR 或者请求，所以使用对应 API 默认会抛出 `ArcadeError` 并提示。欢迎发起 PR 来提供对应功能！

## 开发者与打包

如果要编译该项目并在本地进行修改使用，按照如下方法启动 `tsup` 预构建：

```bash
cd maimai.js
npm install
npm run build
```

由于涉及大量的 `.json` 加载工作并且包含原生导出项，目前打包工具采用 `tsup`。

```
├── src
│    ├── providers  - 所有平台查分支持模块（包括了本地 json 文件）
│    ├── utils      - JSON, HTML 和分数换算实用组件
│    ├── enums.ts   - 主分类和枚举
│    ├── models.ts  - Maimai 原始数据类
│    ├── exceptions.- 抛出的所有错误支持
│    ├── cache.ts   - 原生 lru-cache 适配的缓存驱动抽象
│    └── maimai.ts  - MaimaiClient 入口主文件
```

---
All Rights Reserved by original `maimai.py` authors. 欢迎体验在任意前端框架中使用 maimai.js ！
