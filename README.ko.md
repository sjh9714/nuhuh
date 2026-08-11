<h1 align="center">nuhuh</h1>

<p align="center">
  <em>에이전트가 "완료했습니다"라고 말하면, nuhuh는 실험으로 확인합니다.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nuhuh"><img src="https://img.shields.io/npm/v/nuhuh?style=flat-square&color=111111&label=npm" alt="npm"></a>
  <a href="https://github.com/sjh9714/nuhuh/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/sjh9714/nuhuh/ci.yml?branch=main&style=flat-square&color=111111&label=ci" alt="CI"></a>
  <img src="https://img.shields.io/node/v/nuhuh?style=flat-square&color=111111" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <sub><a href="README.md">English</a></sub>
</p>

<p align="center">
  <img src="docs/demo.gif" width="880" alt="nuhuh 데모: 에이전트가 4가지 완료를 주장하고, nuhuh가 현실을 재실행해 그중 2개가 거짓임을 잡아냅니다">
</p>

코딩 에이전트는 거의 모든 작업을 같은 말로 끝냅니다: **"완료했습니다! 테스트도 전부 통과합니다."**
사실일 때도 있습니다. 하지만 이를 실측한 연구에 따르면, 스스로 채점한 실패
런 중 [**75.8%가 그래도 성공을 주장**](https://arxiv.org/abs/2606.09863)했습니다.
그리고 그 거짓 완료는 대부분 diff 안이 아니라 **diff 밖**에 있습니다 — 실행된
적 없는 테스트, 설정된 적 없는 환경 변수, 500을 뱉는 엔드포인트.

nuhuh는 diff를 읽지 않고, 모델에게 의견을 묻지도 않습니다. 에이전트의 마지막
메시지에서 주장(클레임)을 하나씩 뽑아 **현실을 새로 재실행**합니다: 깨끗한
프로세스에서 전체 테스트 스위트를, 빌드를, 디스크의 파일을, 로컬 엔드포인트를.
그리고 에이전트가 불러준 영수증이 아니라, **nuhuh가 직접 쓴 영수증**을 발행합니다.

```
🧾 receipt

✅ src/login.ts
   src/login.ts exists (33 bytes)
❌ src/login.test.ts
   src/login.test.ts does not exist
❌ All tests pass.
   ran `npm test` fresh → exit 1 — Tests: 1 failed, 3 passed
✅ The build succeeds.
   ran `npm run build` fresh → exit 0

2 of 4 claims verified, 2 failed.
```

## 10초 체험

```bash
npx nuhuh demo    # 연출된 거짓 "완료"를 잡아내는 장면을 구경 — 설정도, 부작용도 없음
npx nuhuh         # 내 프로젝트에서, 방금 세션의 진짜 "완료"를 검증
```

`nuhuh`는 이미 디스크에 있는 Claude Code 세션 로그(폴백으로 Codex 롤아웃)를
읽고, 마지막 메시지의 완료 클레임을 추출해 각각을 워킹트리와 대조합니다.
계정도, API 키도, **모델 호출도 없습니다** — 아무것도 컴퓨터 밖으로 나가지 않습니다.

## 게이트 모드: "완료"가 기분이 아니게 됩니다

```bash
npx nuhuh init
```

Stop 훅이 설치됩니다. 이후 에이전트가 작업을 끝내려 할 때마다:

1. 마지막 메시지에서 클레임을 추출하고
2. 실험을 돌립니다 (테스트 신선 실행, 빌드, 파일, 엔드포인트, env)
3. **거짓 클레임이 있으면 "완료"가 거부되고**, 실패 증거가 에이전트에게
   그대로 전달되어 다시 일하러 갑니다
4. 3번 반송해도 안 되면 말싸움을 멈추고 영수증을 사람에게 넘깁니다

에이전트가 돌렸다고 맹세한 테스트를 다시 돌려보는 사람 — 그 역할이 없어집니다.
`nuhuh uninit`으로 제거, `NUHUH_OFF=1`로 일시 정지.

## 무엇을 검사하나

| 에이전트의 말 | nuhuh의 행동 |
| --- | --- |
| "테스트 전부 통과" | **전체** 스위트를 깨끗한 프로세스에서 새로 실행 — 산문이 아니라 종료 코드를 읽음. 세션이 `.skip`/`.only`/`xit`를 추가했다면 함께 기록 (실행되지 않는 테스트는 실패할 수도 없으니까) |
| "빌드 성공" | 빌드 스크립트 실행; 종료 코드가 판정 |
| "`src/x.ts` 만들었음" | 파일이 실제로 있는지 확인 |
| "`legacy.js` 삭제함" / "X는 없음" | 정말 없는지 확인 |
| "localhost:3000 엔드포인트 동작함" | 실제로 호출 (오직 로컬 호스트만) |
| "`DATABASE_URL`을 .env에 설정함" | 키 존재만 확인 — 값은 절대 영수증에 담지 않음 |

클레임 매칭은 현재 영어와 한국어를 지원합니다 (패턴은
[데이터 파일](src/claims/patterns.ts)이라, 언어 추가는 포크가 아니라 PR입니다).

## 왜 LLM에게 검사를 안 시키나

측정됐고, 못 하기 때문입니다. 판사 모델 5종 × 프롬프트 전략 5종 전부에서 LLM
판사의 거짓 완료 탐지력은 [**AUROC 0.54~0.65**](https://arxiv.org/abs/2606.09863)
— 동전 던지기 수준이었습니다. "검증된 상태 변화가 아니라 자신감 있는 마무리
말투 같은 표면적 완료 신호에 의존"하기 때문입니다. 테스트 러너는 실패하는
스위트를 1.0으로 탐지합니다. nuhuh는 Stop 훅을 입은 테스트 러너입니다:
**검증 경로에 LLM 호출 0회, 결정론적, 같은 세션 → 같은 영수증.**

반대편의 diff 리뷰 방식에는 정반대의 맹점이 있습니다: diff를 정답으로 읽는
리뷰어는 *diff 밖의* 미스를 볼 수 없습니다 — 설정 안 된 env, 실행 안 된
마이그레이션, 떠 있지 않은 서버. 정확히 그 클레임들을 nuhuh가 찔러봅니다.

## False Done Rate 벤치마크

`bench/`에는 하네스별로 "완료"가 얼마나 자주 거짓인지, **그중 nuhuh가 몇 개를
잡고 몇 개를 놓치는지**까지 측정하는 재현 가능한 벤치마크가 있습니다. 그라운드
트루스는 nuhuh를 전혀 모르는 결정론적 `check.sh` 스크립트라서, 이 벤치마크는
nuhuh 자신의 맹점도 드러냅니다 (드러내는 것이 목적입니다).
방법론과 한계: [bench/README.md](bench/README.md).

## 하지 않는 것

- 코드가 *좋은지*는 말해줄 수 없습니다. 에이전트가 **말한 것**과 당신의 기계가
  **실제로 하는 것**이 일치하는지를 말해줍니다 — 더 작지만, 검증 가능한 주장입니다.
- 안전하게 검사할 방법이 없는 클레임은 `⚠️ unverifiable`로 표시할 뿐, 절대
  `failed`로 몰지 않습니다. 타임아웃은 아무것도 증명하지 않으므로 실패 취급하지
  않습니다. 이 도구는 **누명보다 미탐**을 선택하도록 조율되어 있습니다.
- 오직 로컬호스트만 프로브하고, 프로젝트 안만 읽고, 프로젝트 자신의 매니페스트에
  정의된 명령만 실행합니다 — 에이전트의 텍스트에서 가져온 명령은 절대 실행하지 않습니다.

## 관련 프로젝트

- [taskmaster](https://github.com/blader/taskmaster) — 에이전트가 끝났다고 *말할* 때까지 일을 시킵니다. 그 말은 신뢰됩니다. nuhuh는 재실행할 수 있는 것 외엔 아무것도 신뢰하지 않습니다.
- [tdd-guard](https://github.com/nizos/tdd-guard) / [probity](https://github.com/nizos/probity) — *편집 중* 프로세스(테스트 우선)를 강제합니다. nuhuh는 "완료" 시점의 결과를 검사합니다. 함께 쓰면 좋습니다.
- [agent-done-or-not](https://github.com/mohamedzhioua/agent-done-or-not) — 에이전트가 감싸기로 선택한 명령의 영수증을 기록합니다. nuhuh는 에이전트의 협조가 필요 없습니다 — 평문에서 클레임을 뽑아 직접 재실행합니다.
- [backcheck](https://github.com/VectorInstitute/backcheck), [agent-receipts](https://github.com/0xelitesystem/agent-receipts) — *트랜스크립트*가 말하는 과거를 감사합니다. nuhuh는 *지금* 무엇이 사실인지를 검사합니다.
- Claude Code의 `/verify` — diff를 정답으로 읽고, 명시적으로 테스트를 실행하지 않습니다. nuhuh는 diff 밖의 버그를 위해 존재합니다.

## 요구 사항

Node 20+. Claude Code 세션은 `~/.claude/projects`, Codex 롤아웃은 `~/.codex`에서
읽습니다. 테스트/빌드 신선 실행은 프로젝트 자신의 `package.json` 스크립트를
사용합니다 (pnpm/yarn/bun은 락파일로 감지).

## License

MIT
