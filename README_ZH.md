[English](README.md) | 简体中文

# Last Light — AI 互动叙事

**创造世界。做出选择。改变故事。**

Last Light 是为 Cal Hacks 13.0 开发的 AI 互动叙事项目。

我们希望让用户创造自己的虚构世界，成为其中的角色，体验随每个决定动态发展的故事。

与依赖预设分支的传统互动小说不同，Last Light 尝试结合生成式 AI、持续保存的故事记忆与玩家行动，带来个性化、且选择真正影响后续发展的叙事体验。

## 演示

### 当前的 AI 冒险

当前应用根据你的故事设定、角色、氛围与可选世界细节，生成五幕冒险。每当你做出决定，Cloudflare Workers AI 或 Gemini 才会创作下一幕。每幕包含 2–4 个可查看的物品，其描述与发现的线索会通过故事记忆延续到后续场景。

如需使用自己的密钥，请克隆此分支并创建本地配置：

```bash
git clone --branch feature/openai-scene-objects https://github.com/Curious-Entity/Cal-Hacks-13.git
cd Cal-Hacks-13
cp last-light/.env.example last-light/.env
# Edit last-light/.env locally; add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
# Set TEXT_PROVIDER=cloudflare to use Cloudflare for stories.
python3 last-light/run.py
```

打开终端输出的网址。启动器会在 8000–8010 中选择空闲端口，并在需要时查找或下载经过校验的 Node.js 运行环境。游戏过程中请保持终端开启。静态 Python HTTP 服务器无法运行 AI 接口。

启动器需要 Python 3.12+。本地游玩无需执行 `npm install` 或生产构建。如果 `.env` 不存在，启动器会根据空白模板创建文件，不会覆盖已有配置。如果已安装 Node.js 22.13+，也可以先执行 `cd last-light`，再运行 `node server.mjs`。

`CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN` 可同时启用故事生成与 Cloudflare 插画，无需 Gemini 密钥。队友仍可使用 `GEMINI_API_KEY`（或 `GOOGLE_API_KEY`）生成 Gemini 故事。每位队员应使用自己的密钥。在设置中启用 AI 插画，开始故事后点击 **为这一幕绘制插画**（**Illustrate this scene**）。内置氛围画面与 AI 插画均支持物品交互。

原版预设列车冒险位于 `/sample.html`，无需 API 密钥。

### 界面语言

两个游戏页面右上角都有语言按钮，可在 English 与简体中文之间即时切换，无需刷新。首次使用默认为英语，语言偏好通过 localStorage 保存；若浏览器禁止存储，则在当前页面内仍可切换。

语言按钮翻译界面文案、列车演示的预设故事与选项。AI 返回的故事、标题、角色、选项、物品描述与线索保留原始语言，切换界面不会翻译已生成的故事或重新请求模型。

新冒险会将当前选择的语言写入经过校验的 `setup.language`（`en` 或 `zh-CN`），并保存在签名旅程中。每幕提示词都要求叙事、标题、选项、物品、线索、角色关系与记忆使用该语言。未提供语言的请求与旧存档默认使用英语。游戏过程中切换界面，不会翻译已有故事或改变当前旅程的语言；如需另一种语言，请开始新冒险。实际输出仍取决于模型，不符合场景结构的结果会被拒绝。

### Cloudflare 故事配置

保留 `last-light/.env` 中已有的 Cloudflare 凭据，并添加以下设置：

```dotenv
TEXT_PROVIDER=cloudflare
IMAGE_PROVIDER=cloudflare
ENABLE_IMAGE_GENERATION=true
# Optional override; this is the default text model:
# CLOUDFLARE_TEXT_MODEL=@cf/qwen/qwen3-30b-a3b-fp8
```

文本适配器使用 [Cloudflare Qwen3 模型](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)，请求符合 JSON Schema 的输出，并与 Gemini 共用服务器端场景校验。令牌需要当前账户范围内的 Workers AI Read/Edit 权限。文本与图片共享 Workers AI 使用额度，配额、权限或容量不足时请求可能失败，应用不会自动切换服务商。参阅 [JSON 模式](https://developers.cloudflare.com/workers-ai/features/json-mode/)与 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)。

未指定 `TEXT_PROVIDER` 时，已有 Gemini 密钥优先；否则使用 Cloudflare 凭据。显式设置 `TEXT_PROVIDER=cloudflare`，即可在同时配置 Gemini 密钥时仍使用 Cloudflare。队友可设置 `TEXT_PROVIDER=gemini` 并配置 `GEMINI_API_KEY`。图片服务单独选择。

更新后端代码后，请重启正在运行的服务器，并重新打开输出的网址。本地 `.env` 在每次 API 请求时重新读取，但非空的进程环境变量优先。`/api/config` 返回 `configured`、`textProvider` 与 `textModel`，不会返回凭据。已配置不代表验证成功，需要开始故事才能确认账户访问正常。

线上部署时，在托管环境设置 `TEXT_PROVIDER`、Cloudflare 凭据、图片设置与稳定的 `STORY_SESSION_SECRET`，再通过现有流程部署更新。REST 调用不需要 AI 绑定。本地 `.env` 不会更新线上机密。若旧存档使用 Gemini 密钥签名，删除该密钥前可将原签名值保留为 `STORY_SESSION_SECRET`，以继续验证旧存档；否则需要开始新冒险。自动化测试模拟服务响应，不验证真实账户权限。

### 在线演示

[打开 Last Light](https://last-light-calhacks-thirteen.awaregoat514.chatgpt.site)。此前文档将此演示标记为仅所有者可访问。本次文档更新没有重新核实其可用性与访问权限。

### 可选 AI 插画

真实凭据只能保存在被 Git 忽略的 `.env` 文件中。不要将密钥写入 `.env.example`、浏览器 JavaScript、截图或 Git 提交。

```dotenv
TEXT_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
IMAGE_PROVIDER=cloudflare
ENABLE_IMAGE_GENERATION=true
OPENAI_IMAGE_USE_REFERENCE=false
```

首次设置时，Cloudflare 插画默认选择 **每幕生成一次**（**Once for every scene**）。已有图像偏好会被保留。你可以关闭图片，或选择 **仅在我请求时**（**Only when I ask**），再点击 **为这一幕绘制插画**（**Illustrate this scene**）。每个实际到达的场景只请求一张图片，未选择的分支不会生成插画。图片会缓存在浏览器中，重新加载后可复用。

Cloudflare 服务默认使用 `@cf/black-forest-labs/flux-2-klein-4b`，分辨率为 1024×768。每段冒险保留固定种子、角色外观描述、故事氛围与美术方向。如果第一幕已有缓存插画，后续场景会将其缩放至最长边 480 像素后作为参考；若第一幕没有缓存插画，则不发送参考图。这有助于保持视觉连贯，但无法保证角色外貌完全一致。绘图期间，选项与可点击物品仍然可用。

如需使用 OpenAI，可设置 `IMAGE_PROVIDER=openai` 并添加 `OPENAI_API_KEY`。默认使用 `gpt-image-2.5-flare`、低画质，每次请求生成一张 1024×1024 JPEG，需要 OpenAI API 额度。默认关闭参考图输入，可通过 `OPENAI_IMAGE_USE_REFERENCE=true` 启用。`IMAGE_PROVIDER=gemini` 会选择 Gemini 图像服务，受项目的图像访问权限与配额限制。这些模型名称与设置描述的是当前代码默认值，并不代表已重新核实服务商的可用性。`OPENAI_IMAGE_MODEL` 可以覆盖 OpenAI 模型。当前选项请参阅 [OpenAI 图像指南](https://developers.openai.com/api/docs/guides/image-generation)。

可点击物品使用独立的 SVG 前景层，因此在不同屏幕尺寸下，点击区域仍与画面对应。物品描述与线索随故事一起返回，查看物品不会额外调用模型或图像服务。

### 连接错误

配置凭据不代表所选文本服务一定会接受请求。只有成功生成场景后，设置状态才会标记为已验证；请求失败时会显示错误，而不会声称故事引擎已就绪。密钥无效、密钥被封禁、项目限制、配额限制与请求参数无效均有各自的提示。

本地 `.env` 只作用于本地服务器。私有在线演示使用独立的服务器密钥；替换本地密钥不会更新线上密钥。所有者需要更新线上机密配置并部署。如果没有设置 `STORY_SESSION_SECRET`，签名优先使用已有 Gemini 密钥，否则使用 Cloudflare 令牌；删除或更换用于签名的凭据会使现有旅程失效，此时需要开始新冒险。如果希望未来更换密钥时保留已有旅程，请在创建冒险前设置独立、稳定的会话签名密钥。

### 自定义氛围与美术方向

在任一菜单中选择 **自定义……**（**Custom…**），即可填写偏好。故事氛围最多 240 个字符，美术方向最多 400 个字符。例如：“苦乐参半，带着冷幽默”，或“纹理纸上的水粉画，琥珀色高光与靛蓝阴影”。草稿会保存在本地，这些偏好会进入每次故事生成与插画提示词。

### 免费 Cloudflare 图像配置

1. 创建免费的 [Cloudflare 账户](https://dash.cloudflare.com/)。
2. 打开 **Workers AI → REST API → Create a Workers AI API Token**。令牌需要当前账户范围内的 Workers AI Read 与 Edit 权限。
3. 复制 Account ID，将其与令牌一起写入被忽略的 `last-light/.env`。请保持已跟踪的 `.env.example` 中凭据为空。
4. 保持 `IMAGE_PROVIDER=cloudflare` 与 `ENABLE_IMAGE_GENERATION=true`，启动服务器，并在启用 AI 插画的情况下开始冒险。

此前配置说明记录，Cloudflare Workers Free 套餐每天提供账户共享的 10,000 Neurons 额度。保持 **Workers Free** 套餐，可让请求在每日限额处停止，而不是产生付费超额。此前说明标注的重置时间为 UTC 00:00；正式演示前，请向 Cloudflare 核实最新额度、价格与模型资格。应用会处理配额与容量错误，保留故事，也不会回退到付费图像服务。参阅 [Cloudflare 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)与 [REST 令牌配置指南](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)。

此前文档报告在 2026 年 10 月 24 日成功调用 Cloudflare 生成图片，首张图片约耗时 37 秒。本次文档更新使用模拟测试，没有重复真实调用。延迟取决于服务容量。[官方 Klein 集成示例](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/)说明了 multipart 请求与参考图输入。生成期间仍可阅读图像描述并查看物品线索。

## 核心概念

Last Light 将一段简单的用户描述转化为可互动的虚构世界。

预期体验包括五个步骤：

1. **世界生成** — 用户描述想要探索的世界。
2. **角色创建** — AI 生成人物、关系与核心冲突。
3. **互动叙事** — 玩家通过选项影响故事，查看物品以发现线索。自由文本行动属于未来扩展。
4. **持久记忆** — 重要选择、事件与世界规则延续到后续章节。
5. **动态结局** — 故事根据玩家此前的行动，走向连贯的结局。

## 体验示例

用户输入：

> 一个魔法王国，每次施法都会永久抹去施法者的一段记忆。

Last Light 生成一个拥有独立历史、人物与规则的虚构世界。

玩家遇到一座禁止进入的魔法档案馆，需要决定下一步行动。

可能的行动包括：

- 使用魔法打开封闭的档案馆。
- 说服守卫允许进入。
- 寻找其他入口。
- 选择生成的行动按钮之一（自由文本行动属于未来扩展）。

每个决定都可能影响后续事件、角色关系与最终结果。

例如，使用魔法可能打开档案馆，却永久抹去主角的一段记忆。

系统应记住这个后果，并将其融入后续章节。

## AI 架构

当前 MVP 的叙事流程如下：

```text
User Prompt
    |
    v
World Generator
    |
    v
World State
    |
    v
Story Engine
    |
    v
Player Choice + Discovered Clues
    |
    v
State & Memory Update
    |
    v
Next Chapter
    |
    v
Dynamic Ending
```

### 世界生成

生成包含以下内容的结构化世界：

- 世界背景与场景
- 重要世界规则
- 主要角色与关系
- 核心冲突
- 故事目标

### 动态故事引擎

根据以下信息生成叙事：

- 当前章节
- 已确立的世界规则
- 玩家此前的决定
- 重要事件与记忆
- 角色关系
- 玩家当前的行动

### 故事记忆

维护结构化状态，以减少叙事矛盾。

例如：

- 重要决定
- 角色信任度
- 已发现的信息
- 物品栏
- 重大世界事件
- 尚未解决的冲突

### 故事推进与结局

当前 MVP 生成五幕：

1. 开端
2. 探索
3. 冲突
4. 高潮
5. 结局

最后一章应根据玩家累积的决定与世界状态，解决核心冲突。

## 当前实现

生成式冒险包含：

- 用户自定义故事设定、主角、氛围、美术风格与可选世界细节
- Cloudflare Workers AI 或 Gemini 场景生成、JSON 校验与稳定的配角阵容
- 五幕故事，每次 2–3 个选项，以及受此前决定影响的结局
- 每幕 2–4 个可点击物品、发现日志，以及进入下一幕上下文的线索
- 矢量氛围画面、Cloudflare 插画，以及可选的 OpenAI/Gemini 图像服务
- 签名故事状态、浏览器保存与继续，以及可重试的 API 错误
- 响应式布局与支持键盘操作的控件

原版列车演示保留了三个预设章节、十二条主要决策路径、三个结局、角色关系与可选环境音。

## 计划中的 MVP 扩展

自由文本行动、更深入的物品机制与更强的一致性检查仍是开发目标。当前 MVP 使用生成的选项按钮，不支持任意文本行动。

## 项目结构

```text
Cal-Hacks-13/
├── README.md
└── last-light/
    ├── run.py                  # Local launcher
    ├── server.mjs              # Local HTTP + API server
    ├── backend/                # Shared story, inspection, and image handlers
    ├── public/                 # HTML/CSS/JS, scene art, original train demo
    ├── worker/index.ts         # Hosted API entrypoint
    ├── .env.example            # Placeholder configuration only
    └── tests/                  # Story, API, object, and image tests
```

## 运行与测试

在仓库根目录运行 `python3 last-light/run.py`，按 `Ctrl+C` 停止。启动器会在 8000–8010 中选择端口；`--port 8001` 可指定端口。

### 运行测试

```bash
python3 last-light/run.py --test
```

测试覆盖原版列车路径、生成式故事推进、签名存档、物品查看与线索记忆、图像请求设置与复用、无效输出、API 错误，以及不含凭据的环境配置模板。自动化测试使用模拟服务响应，不消耗 API 额度。

## 技术栈

### 浏览器与测试

- HTML
- CSS
- JavaScript
- Node.js 内置测试运行器
- 浏览器 localStorage
- SVG 插画

### AI 集成

- Cloudflare Workers AI 或 Gemini API：结构化场景生成
- Cloudflare Workers AI：支持参考图的免费额度场景插画
- 可选的 OpenAI Images API 与 Gemini 图像服务
- 服务器端模型集成
- 结构化 JSON 响应
- 持久化世界与故事状态
- AI 叙事生成与校验

API 密钥必须保留在服务器端，绝不能嵌入前端 JavaScript。

## API 配置与请求流程

所有服务商请求均在服务器执行。本地 `server.mjs` 与线上 `worker/index.ts` 共用 `backend/adventure.js`；浏览器调用同源 API。

本地服务器会在每次 API 请求时读取 `.env`；非空的进程环境变量优先。不要将服务商密钥暴露给浏览器代码。

| 变量 | 用途 |
| --- | --- |
| `TEXT_PROVIDER` | `cloudflare` 或 `gemini`；省略时优先使用已有 Gemini 密钥，否则使用 Cloudflare。 |
| `CLOUDFLARE_TEXT_MODEL` | Cloudflare 故事模型覆盖设置，默认为 `@cf/qwen/qwen3-30b-a3b-fp8`，需要支持 JSON Schema 输出。 |
| `GEMINI_API_KEY` | 可选的 Gemini 故事密钥，也接受 `GOOGLE_API_KEY` 作为替代。 |
| `GEMINI_TEXT_MODEL` | 覆盖故事模型，代码默认值为 `gemini-3.5-flash-lite`。 |
| `STORY_SESSION_SECRET` | 稳定的 HMAC 签名密钥；未设置时优先使用已有 Gemini 密钥，否则使用 Cloudflare 令牌。 |
| `ENABLE_IMAGE_GENERATION` | 必须为 `true` 才能启用已配置的插画服务。 |
| `IMAGE_PROVIDER` | 明确选择 `cloudflare`、`openai` 或 `gemini`。未设置时优先使用已配置的 Cloudflare 凭据，其次是 OpenAI，最后是 Gemini。 |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | 用于文本与图片的 Cloudflare 账户与 Workers AI 凭据。 |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` | 可选的 OpenAI 密钥与模型覆盖设置。 |
| `OPENAI_IMAGE_USE_REFERENCE` | 仅在值为 `true` 时启用 OpenAI 参考图输入。 |
| `GEMINI_IMAGE_MODEL` | 覆盖 Gemini 图像模型，代码默认值为 `gemini-nano-banana-2.1`。 |
| `PORT` | 直接运行 Node 服务器时的端口；Python 启动器会根据端口选择设置此值。 |

| 接口 | 行为 |
| --- | --- |
| `GET /api/config` | 返回配置标志、文本服务与模型、支持的故事语言、图像服务与参考图设置、场景总数，不返回密钥。 |
| `POST /api/story/start` | 接受设置（包含可选的 `language`）与请求 ID，生成第一幕。 |
| `POST /api/story/choose` | 接受签名令牌与当前选项 ID，生成下一幕。 |
| `POST /api/story/inspect` | 接受签名令牌与物品 ID，记录线索，不调用服务商。 |
| `POST /api/story/image` | 接受签名令牌与可选参考图，独立生成插画。 |

POST 接口要求 JSON，并拒绝携带跨域 Origin 请求头的请求。

场景会校验叙事、选项、物品、颜色、结局与稳定的角色 ID。最后一幕没有选项。已发现的线索、累积事实、角色关系、摘要与决策历史共同构成下一幕的上下文。

旅程经过签名，但没有加密，签名七天后过期。浏览器将旅程与待完成请求保存在 localStorage 中，插画则使用 IndexedDB。更换签名密钥会使已有存档失效。服务器端请求去重在进程内存中保留五分钟，并不是持久化的跨实例缓存。查看物品不会改变场景图片的缓存键。

故事上游调用超时为 75 秒，图像调用为 110 秒。失败时会显示可重试的用户提示，不会替换最后一个有效场景。图像失败后，氛围画面与选项仍可使用，Cloudflare 失败也不会自动切换到付费服务商。仅完成服务商配置，不代表凭据、额度与模型访问权限已经验证成功。

## 部署

本地游玩与自动化测试不需要 npm 依赖。线上构建使用 Vinext/Vite 与 Cloudflare Workers，而非纯静态服务器：

```bash
cd last-light
npm run install:ci
npm run build
```

package 脚本会根据执行环境选择构建路径。受管 Linux 构建还需要 GNU `timeout`。构建产物位于 `dist/`；不要提交生成文件，也不要将 `public/` 单独当作完整 AI 应用。

`app/page.tsx` 将线上首页重定向到 `/adventure.html`，`worker/index.ts` 将 `/api/` 路由交给共享后端。原版 `/sample.html` 仍可在无密钥时使用。

现有 `.openai/hosting.json` 标识了 Sites 项目；D1 与 R2 绑定当前为 null。更新现有站点时应保留这些元数据。服务商配置与稳定的 `STORY_SESSION_SECRET` 应作为线上服务器机密配置。本地 `.env` 不会配置线上环境。界面与 API 应保持同源，公开演示使用 HTTPS。

测试与构建成功后，站点所有者应审查具体版本，确认目标受众，批准部署及任何公开访问权限变更，再通过现有 Sites 流程发布。上述配置命令不会执行部署。随后应在最终网址验证五幕流程、物品线索、重新加载与继续，以及图片失败后的回退。本次文档更新未执行生产构建，也未核实线上访问权限。

## 开发优先级

1. 保持互动原型可用。
2. 改进动态 AI 故事生成。
3. 优化用户创建的世界与场景探索。
4. 添加有意义的自由文本行动。
5. 保持故事一致性与记忆。
6. 生成连贯结局。
7. 测试、部署并准备最终演示。

## 测试与可靠性

AI 体验应测试以下方面：

- 世界成功生成
- 玩家选项与行动有效
- 符合已确立的世界规则
- 正确使用此前故事事件
- 选择带来有意义的后果
- 叙事结局连贯
- 妥善处理 API 错误
- 成功保存与继续
- 部署应用的端到端功能

当 AI 生成失败时，应用应提供适当的回退或错误提示，不损坏已保存的故事状态。

## Cal Hacks 13.0

本项目于 2026 年 10 月 23–25 日在旧金山 Cal Hacks 13.0 期间开发。

### 目标奖项类别

- 最具创意项目
- 技术最先进的 Hack
- AI 相关赞助商挑战，具体取决于参赛资格与最终实现

## 团队

由四位开发者在 Cal Hacks 13.0 期间共同完成。

队员姓名与贡献将在最终提交前补充。

## 未来可能性

可能的扩展包括：

- AI 生成角色肖像
- 世界地图
- 语音旁白
- 多人互动叙事
- 更复杂的 NPC 记忆
- 更长且可重复游玩的故事战役

这些功能不属于初期 MVP 范围。

---

**Last Light — 每个选择，都成为你故事的一部分。**
