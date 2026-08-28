# 练途知识库来源与许可证报告

本项目只保存合法公开资料的原文件或网页离线副本，并用原创中文知识卡总结可执行规则。完整来源字段见 `sources.json`。

## 可再分发开放资料

- IUSCA 增肌立场声明：CC BY 4.0；本地保存原 PDF，使用时保留作者、标题、DOI 和许可证。
- Frontiers 减载研究：CC BY 4.0；本地保存原 PDF，使用时保留作者、标题、DOI 和许可证。
- Human Nutrition：CC BY-NC-SA 4.0；仅总结基础营养原则。
- The Physiology of Exercise：CC BY-NC；仅总结运动生理原则。
- OpenStax Anatomy & Physiology 2e：CC BY-NC-SA 4.0；仅作解剖生理索引。
- USDA FoodData Central：美国公共领域 / CC0 数据，用于本地营养计算。
- FreeGym-Wiki：CC BY-SA 4.0；仅作开放知识索引。

## 公开阅读但不复制模板的资料

- ACSM 2026、Autoregulation 2021、ISSN、AIS：保存官方公开页面或引用链接，只写原创摘要与规则。
- GZCL、TSA、Barbell Medicine、r/bodyweightfitness Recommended Routine、CrossFit WOD：只总结分化、阶段、进阶、缩放和自我调节思想，不内置原始表格或逐字模板。

## 开源程序参考边界

- Liftosaur 与 wger 的程序代码为 AGPL 系列许可证。本项目只研究公开行为、数据结构和接口思想，不复制其 AGPL 源码。
- 动作媒体逐项记录作者、许可证与来源；清单保存在 `exercise-media.json`。wger 图片仅打包已确认 Creative Commons 许可的条目，缺图动作使用无品牌、无水印的项目原创 AI 示意图。

## 构建校验

`npm run knowledge:build` 会检查：来源许可证说明、本地文件存在、知识卡必填段落、规则来源、未知来源、重复规则以及上下限冲突。`npm run media:validate` 会检查每个内置动作都有离线图片，并验证 wger 署名字段完整。
