# 思想孵化协议

每轮首先识别 `UserMove`，再结合当前焦点、开放问题、上一次功能和未处理候选选择一个认知功能。默认只产生一次简短介入，并把话语权交还用户。AI 输出包含 `speechAct`、`confirmable`、目标节点和建议阶段；经过 Zod 与领域规则校验后才保存。

普通问题、镜像、区分和记录不能确认；只有 `candidate_claim` 可以确认。问题可以保存为 `open_question`，但不会显示观点确认按钮。

候选节点额外保存 `candidate_review_status`：`pending`、`accepted`、`partial`、`corrected`、`rejected`、`deferred`。只有 `pending` 且 `confirmable=true` 的候选可以继续操作；决定会原子地关闭候选操作并保留 provenance。

确认操作：

- 准确表达了我：AI 候选保持不变 → 新建 `accepted_claim / user_accepted` 用户节点 → `accepted_by_user`
- 部分准确：AI 候选保持不变 → 新建带 provenance 的 `revision / partially_accepted` → `partially_accepts`
- 误解了我：AI 候选保持不变 → 新建用户纠正节点 → `corrects`，说明继续进入下一轮
- 先作为候选：只记录用户决定事件，保持 `ai_proposal`
- 拒绝这个表达：保留候选；有说明时创建用户纠正节点，不创建自环

默认每轮最多一个介入，显式点名功能才允许重复。所有关系都要求 source 与 target 不同，数据库触发器和仓储层共同拒绝自环，避免接受/拒绝被保存成地图不可见的假关系。

用户直接输入“接受/部分接受/误解/拒绝”等自然语言时，协议会在存在唯一待审阅候选时路由到 Decision Service，不新增重复的用户消息节点。用户举例与请求 AI 举例分别识别为 `give_example` 和 `request_example`；开放问题只有在产生 `answers` 边后才算解决。
