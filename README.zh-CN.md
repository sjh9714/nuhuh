<h1 align="center">nuhuh</h1>

<p align="center">
  <em>你的智能体说"完成了"。nuhuh 用实验来验证。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nuhuh"><img src="https://img.shields.io/npm/v/nuhuh?style=flat-square&color=111111&label=npm" alt="npm"></a>
  <a href="https://github.com/sjh9714/nuhuh/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/sjh9714/nuhuh/ci.yml?branch=main&style=flat-square&color=111111&label=ci" alt="CI"></a>
  <img src="https://img.shields.io/node/v/nuhuh?style=flat-square&color=111111" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <sub><a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <img src="docs/demo.gif" width="880" alt="nuhuh 演示。智能体声称完成了四件事，nuhuh 重新执行现实检查，抓到其中两条是假的">
</p>

编码智能体几乎每次都用同一句话收尾。**"完成了！所有测试都通过。"**
有时这是真的。但研究者实测发现，在自我评分的失败运行中，
[**75.8% 仍然宣称成功**](https://arxiv.org/abs/2606.09863)。
而且假完成很少出现在 diff 里。它们藏在从未运行过的测试里，从未设置过的
环境变量里，返回 500 的接口里。

nuhuh 不读 diff，也不问模型的意见。它把智能体最后一条消息里的每个声明拿出来，
**重新对现实执行一遍**。在干净的进程里跑完整测试套件，跑构建，查磁盘上的文件，
调本地接口。然后打印一张 nuhuh 自己写的收据，而不是智能体口述的那张。

```
🧾 receipt

✅ src/login.ts
   src/login.ts exists (33 bytes)
❌ src/login.test.ts
   src/login.test.ts does not exist
❌ All tests pass.
   ran `npm test` fresh, exit 1 ("Tests: 1 failed, 3 passed")
✅ The build succeeds.
   ran `npm run build` fresh, exit 0

2 of 4 claims verified, 2 failed.
```

## 10 秒上手

```bash
npx nuhuh demo    # 看它当场抓住一个排练好的假"完成"。零配置，不碰任何东西
npx nuhuh         # 在任何项目里，检验你最近一次会话的真实"完成"
```

nuhuh 读取磁盘上已有的 Claude Code 会话日志，并以 Codex rollout 作为回退。
它从最后一条消息中提取完成声明，逐条对照你的工作树验证。不需要账号，
不需要 API key，**没有任何模型调用**。任何数据都不会离开你的机器。

## 门禁模式，让"完成"不再是一种感觉

```bash
npx nuhuh init
```

这会安装一个 Stop 钩子。此后每当智能体想要收工，

1. nuhuh 从它的最后一条消息中提取声明
2. 逐条做实验（新鲜的测试运行、构建、文件、接口、env）
3. **只要有假声明就拒绝"完成"**，并把失败证据原样喂回给智能体，让它回去继续干
4. 弹回 3 次后不再争论，把收据交给人类

你不用再当那个在智能体发誓测试通过之后又亲自重跑一遍的人。
用 `nuhuh uninit` 卸载，用 `NUHUH_OFF=1` 临时暂停。

## 它检查什么

| 智能体说 | nuhuh 做 |
| --- | --- |
| "所有测试都通过" | 在干净进程里重新跑**完整**套件，读退出码而不是文风。还会记录会话新加的 `.skip`、`.only` 或 `xit`，因为不再运行的测试永远不会失败 |
| "构建成功" | 运行构建脚本，退出码说了算 |
| "我创建了 `src/x.ts`" | 检查文件是否真的存在 |
| "我删除了 `legacy.js`" 或 "不存在 X" | 检查它是否真的不在了 |
| "localhost:3000 的接口能用" | 真的去调用它（永远只探测本地主机） |
| "我在 .env 里设置了 `DATABASE_URL`" | 只检查键是否存在，值永远不会进入收据 |

目前声明匹配支持英语和韩语。模式是[一个数据文件](src/claims/patterns.ts)，
所以增加语言是一个 PR，不是一个 fork。

## 为什么不直接让 LLM 来检查

因为有人测过了，它做不到。在 5 个裁判模型和 5 种提示策略下，LLM 裁判检测
假完成的能力只有 [**AUROC 0.54 到 0.65**](https://arxiv.org/abs/2606.09863)，
接近抛硬币，因为它们"依赖自信的收尾语气这类表面完成信号，而不是经过验证的
状态变化"。测试运行器检测失败套件的能力是 1.0。nuhuh 就是一个穿着 Stop 钩子
的测试运行器。**验证路径零 LLM 调用，完全确定性，同样的会话进去，同样的收据出来。**

读 diff 的方案有相反的盲区。把 diff 当作事实的审查者看不到 diff 之外的遗漏，
比如没设的环境变量、没跑的迁移、没在监听的服务。而这些恰恰是 nuhuh 去戳的声明。

## False Done Rate 基准测试

`bench/` 里有一个持续增长、可复现的基准，按 harness 测量"完成"有多经常是假的，
**以及其中 nuhuh 抓住了几个、漏掉了几个**。地面真值是一组完全不知道 nuhuh 存在的
确定性 `check.sh` 脚本，所以这个基准也能暴露 nuhuh 自己的盲区。

它已经做到了。第一次真实运行就抓到 nuhuh 的四类误伤（把行号引用当路径、把代码
标识符当路径、删除对象归属错误、把写在 `.env.example` 里的键冤枉了）。每一类
现在都是永久回归测试。方法论和诚实的局限见 [bench/README.md](bench/README.md)。

## 它不做什么

- 它无法告诉你代码写得*好不好*。它告诉你智能体**说的**和你的机器**做的**
  是否一致。这是一个更小、但可检验的命题。
- 没有安全手段检查的声明会被标为 `⚠️ unverifiable`，永远不会是 `failed`。
  超时什么也证明不了，永远不按失败处理。这个工具宁可漏报也不冤枉，
  因为一次冤枉毁掉信任，一次漏报只损失一次检查。
- 它永远只探测 localhost，只读项目内部，只运行项目自己清单里定义的命令，
  绝不运行来自智能体文本的命令。

## 相关项目

- [taskmaster](https://github.com/blader/taskmaster) 让智能体一直干到它*说*完成为止，那个完成标记是被信任的。nuhuh 不信任任何它能重新执行的东西。
- [tdd-guard](https://github.com/nizos/tdd-guard) 和 [probity](https://github.com/nizos/probity) 在*编辑过程中*强制流程（测试先行）。nuhuh 在"完成"时刻检验结果。两者可以搭配使用。
- [agent-done-or-not](https://github.com/mohamedzhioua/agent-done-or-not) 记录智能体选择包装的命令的收据。nuhuh 不需要智能体配合，它从自然语言中提取声明并重新执行。
- [backcheck](https://github.com/VectorInstitute/backcheck) 和 [agent-receipts](https://github.com/0xelitesystem/agent-receipts) 审计*转录*里说发生了什么。nuhuh 检验*现在*什么是真的。
- Claude Code 自带的 `/verify` 把 diff 当作事实并明确不运行测试。nuhuh 为 diff 之外的 bug 而存在。

## 环境要求

Node 20 或更高。Claude Code 会话从 `~/.claude/projects` 读取，Codex rollout
从 `~/.codex` 读取。新鲜的测试和构建运行使用项目自己的 `package.json` 脚本，
pnpm、yarn 和 bun 通过锁文件识别。

## License

MIT
