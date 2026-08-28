---
id: open-source-training-engines
title: 开源训练引擎的可借鉴边界
evidence_level: C
applicable_population: product_and_program_design
sources: liftosaur, wger, workout-cool
rule_ids: open-engine-behavior-only, media-license-per-item
---

# 开源训练引擎的可借鉴边界

一句话结论：开源软件适合学习计划表达、训练记录和进阶行为，但训练处方仍须由循证规则决定。

解决什么问题：说明 Liftosaur、wger 与 workout.cool 分别可用于研究计划脚本、动作数据和训练记录界面。

不解决什么问题：开源代码的存在不证明内置训练模板有效，也不自动授予第三方动作媒体的再分发权。

关键变量：软件许可证、媒体条目许可证、计划版本、进阶状态、失败回退、动作与器械字段。

适用人群：训练产品设计者、希望审计计划来源的训练者和需要离线动作库的应用。

如何监测：每条规则是否有证据来源、每张图片是否有作者与许可证、是否复制了 AGPL 实现。

什么时候保持：只参考公开行为和数据模型，原创实现通过本项目测试，并逐项保存媒体署名。

什么时候调整：许可证无法确认、上游数据发生变化、规则无法追溯到独立训练证据时停止打包相关内容。

证据等级：C，属于软件与数据结构参考，不是训练效果证据。

仍有哪些不确定性：上游项目、API 和媒体条目可能更新，构建前仍需重新审计。
