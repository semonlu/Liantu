---
id: open-source-training-engines
title: 开源训练引擎的可借鉴边界
evidence_level: C
applicable_population: product_and_program_design
sources: free-exercise-db, exercises-dataset, liftosaur, wger, workout-cool
rule_ids: open-engine-behavior-only, media-license-per-item
---

# 开源训练引擎的可借鉴边界

一句话结论：开源软件适合学习计划表达、训练记录和进阶行为，但训练处方仍须由循证规则决定。

解决什么问题：说明 exercises-dataset、free-exercise-db、Liftosaur、wger 与 workout.cool 分别用于动图/中文说明、双图动作底库、计划脚本、训练日/媒体数据模型和计划编辑界面。

不解决什么问题：开源代码的存在不证明内置训练模板有效，也不自动授予第三方动作媒体的再分发权。

关键变量：软件许可证、媒体条目许可证、计划版本、进阶状态、失败回退、动作与器械字段。

适用人群：训练产品设计者、希望审计计划来源的训练者和需要离线动作库的应用。

如何监测：每条规则是否有证据来源、每批图片是否有来源与许可证记录、是否复制了 AGPL 实现。

什么时候保持：exercises-dataset 作为优先动图与中文说明层，free-exercise-db 作为 Unlicense 双图补充层；Liftosaur 用于理解可编程进阶与失败回退；wger 用于理解训练日、动作、组次和媒体元数据；workout.cool 用于理解计划编辑与动作库交互。原创实现必须通过本项目测试。

什么时候调整：许可证无法确认、上游数据发生变化、规则无法追溯到独立训练证据时停止打包相关内容。

证据等级：C，属于软件与数据结构参考，不是训练效果证据。

仍有哪些不确定性：三个项目都不能代替训练处方证据，也没有共同提供按用户天数自动选择分化的权威算法；本项目的具体分化必须单独说明产品假设并接受测试。上游项目、API 和媒体条目可能更新，构建前仍需重新审计。
