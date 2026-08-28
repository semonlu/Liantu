# 练途

练途是一款以器械训练为主的本地优先 Android / Web 训练应用。规则引擎根据目标、训练经验、每周频率、恢复反馈和已完成记录生成训练日历；大模型只负责解释、识别和生成待确认的计划提案，不能直接覆盖现有计划。

## 主要模块

- 2 至 6 练分化，训练日标注 T1 主项、T2 次级复合动作、T3 辅助动作和体能模块。
- 新手线性/双重进阶与单动作回退；中级积累、强化、评估和反应式减载。
- 计划版本、日历生效日期、AI 调整差异、拒绝/接受与撤销。
- 八电极体成分报告和常规体检报告识别，确认后才写入本地记录。
- 当日热量与宏量营养分析、剩余目标和后续餐建议。
- 热量镜 v0.3.5 对齐模块：图片估重、本地营养库优先、克数修正和分量倍率。
- 模型连接支持 OpenAI Chat/Responses、Anthropic Messages、Gemini GenerateContent、Ollama 原生协议，以及智谱、DeepSeek、OpenRouter、硅基流动、LM Studio 和自定义兼容端点；APK 可连接本机或局域网 HTTP 端口。
- 25 个内置动作全部具有离线示范图；wger 素材逐项保留 CC 署名，缺图动作使用统一灰白解剖风格的项目原创 AI 图片。
- 离线训练、日历、历史和知识规则；联网只用于大模型、图片识别与资料更新。

## 开发与校验

要求 Node.js 22+、JDK 17 和 Android SDK 36。

```powershell
npm install
npm run knowledge:build
npm run media:validate
npm run model:validate
node --experimental-strip-types scripts/validate-training.ts
node --experimental-strip-types scripts/validate-nutrition.ts
npm run build
npm run mobile:build
```

Android 包名为 `com.local.liantu`，最低 Android 10（API 29）。首次构建 Android 工程后，将本机签名配置写入 `signing/signing.properties`，再运行：

```powershell
npm run android:release
```

签名密钥及密码不提交到源码仓库。后续覆盖升级必须继续使用同一份 `liantu-release.jks`。

## 知识与许可证

来源分级、下载状态和用途见 `Training-Nutrition-KB/SOURCE_MANIFEST.md`；动作资源和知识库许可证见 `Training-Nutrition-KB/LICENSE_REPORT.md`。AGPL 项目只用于研究架构与行为，没有复制其源码。
