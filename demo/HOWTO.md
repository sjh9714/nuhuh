# README 데모 GIF 방법론

이 폴더의 `movie.html` + `shoot.mjs` + `build.sh` 세 파일이 `docs/demo.gif`를
만든다. 이 문서는 그 원리와 작업 순서를 다른 저장소에서 그대로 재활용할 수
있게 적은 것이다. `shoot.mjs`와 `build.sh`는 장면에 의존하지 않으므로 폴더째
복사하고 `movie.html`만 새로 쓰면 된다.

## 0. 한 줄 요약

**화면 녹화가 아니다.** 앱처럼 생긴 HTML 한 장을 만들고, "시간 t를 주면 그
시점 화면을 그리는" 순수 함수를 붙인 뒤, 헤드리스 크롬으로 프레임마다
스크린샷을 찍어 ffmpeg으로 GIF를 조립한다.

```
demo/movie.html   장면. 앱을 재현한 마크업 + window.seek(t) 타임라인
demo/shoot.mjs    촬영. puppeteer-core로 seek(t) 호출하며 프레임 PNG 저장
demo/build.sh     조립. ffmpeg으로 PNG 시퀀스를 팔레트 최적화 GIF로
```

## 1. 왜 녹화하지 않는가

- **재현이 안 된다.** 같은 조작을 다시 해도 타이밍이 달라져 "여기서 0.3초만
  더 머물자" 같은 수정에 전체 재촬영이 필요하다.
- **읽히지 않는다.** GIF는 1000px 안팎으로 줄여 넣는데 실제 UI를 그대로 담으면
  글자가 뭉개진다. 줌과 팬이 필요한데 녹화본에 후처리로 넣기는 번거롭다.
- **환경이 묻는다.** 실제 경로, 포트, 파일명, 알림 배너가 프레임에 남는다.
- **느리다.** 진짜 실행을 기다려야 한다. 보여주고 싶은 건 대기가 아니라 흐름이다.

seek(t) 방식은 프레임이 시간의 순수 함수라서 몇 번을 렌더해도 같고, 타이밍
수정은 숫자 하나 고치는 일이 되고, 줌은 카메라 키프레임 한 줄이 된다.

대가는 하나다. **UI를 한 번 흉내 내야 한다.** 이때 진짜와 다르게 그리면
거짓말이 된다. 이 저장소는 CLI의 실제 출력 포맷과 ANSI 색(초록 3fb950,
빨강 f85149, dim 8b949e)을 그대로 옮겼다. 실제 출력을 먼저 캡처해 놓고
(`node dist/cli.js demo`) 그 텍스트를 상수로 붙여 넣는 순서가 안전하다.

## 2. 세 가지 계약

장면 파일이 촬영 스크립트에 노출하는 것은 이것뿐이다.

```js
window.seek(t)    // t(ms) 시점의 화면을 그린다. 부수효과 없이 몇 번 호출해도 동일
window.DURATION   // 전체 길이(ms)
window.ready      // 폰트와 레이아웃 준비 완료 Promise
```

seek이 순수해야 한다는 것이 핵심이다. "이전 프레임에서 이만큼 진행" 같은
상태를 들고 있으면 안 되고 언제나 t만 보고 처음부터 계산한다. 그래야 특정
구간만 다시 렌더할 수 있다.

## 3. 장면 만들기

### 3.1 고정 캔버스

```css
html,body{width:1920px;height:1080px;overflow:hidden;background:#101216;margin:0}
#world{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
```

반응형은 필요 없다. 1920×1080 고정, 뷰포트도 같은 값. `#world`가 카메라가
움직일 레이어다. 폰트는 시스템 스택(ui-monospace 등)만 쓰면 네트워크 의존이
없어 재현이 완전해진다. CDN 폰트를 쓰면 헤드리스에서 실패 시 조용히 다른
폰트로 떨어진다. 어느 쪽이든 `await document.fonts.ready`는 반드시 기다린다.

### 3.2 콘텐츠는 상수로

화면에 나올 텍스트를 파일 위쪽에 상수로 모은다. 문구 수정이 쉬워진다.

### 3.3 타이밍 표

**연출의 전부가 이 표에 있다.** 각 항목은 `[시작, 끝]` ms.

```js
const T={
  type:[200,1500], hook:[1700,2200],
  r1:[2800,3150], r2:[3450,3850], r3:[4200,4650], r4:[4900,5250],
  sum1:[5550,5900], reject:[6150,6700],
  clear:[7300,7650], ...
};
const DURATION=11700;
```

템포를 바꾸고 싶으면 이 숫자만 만진다. 10초 안팎에 7~8비트가 한계다.
12초를 넘기면 끝까지 보는 사람이 급감한다.

### 3.4 보간 유틸 다섯 줄

```js
const clamp01=v=>v<0?0:v>1?1:v;
const prog=(t,a,b)=>clamp01((t-a)/(b-a));          // 구간 내 진행도 0..1
const seg=(t,a,b)=>t>=a&&t<b;                       // 구간 안인가
const ease=x=>x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;   // easeInOutQuad
const lerp=(a,b,x)=>a+(b-a)*x;
```

이 다섯 개로 모든 애니메이션을 만든다. 라이브러리 없음.

### 3.5 좌표는 측정해서 얻는다

카메라 목표를 손으로 적으면 레이아웃을 고칠 때마다 어긋난다. DOM에서 잰다.

```js
function center(el){const r=el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];}
function measure(){ const red=center($('p3')); /* ...카메라 표를 여기서 조립 */ }
window.ready=(async()=>{ await document.fonts.ready; measure(); seek(0); })();
```

측정 시점에는 모든 요소가 레이아웃에 존재해야 한다. 등장 연출은 opacity와
transform으로만 하고 display none은 쓰지 않는 이유다.

### 3.6 카메라

경로는 `[시각, x, y, 배율]` 배열이고 공통 보간 함수 하나가 처리한다.

```js
function pathAt(path,t,dims){
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    if(t>=a[0]&&t<=b[0]){const x=ease(prog(t,a[0],b[0]));
      return dims.map((_,k)=>lerp(a[k+1],b[k+1],x));}
  }
  const L=path[path.length-1];return dims.map((_,k)=>L[k+1]);
}
const [cx,cy,s]=pathAt(CAM,t,[0,0,0]);
$('world').style.transform=`translate(${960-cx*s}px,${540-cy*s}px) scale(${s})`;
```

`(화면중심 − 목표점×배율)` 공식만 기억하면 된다. 같은 좌표를 두 번 연속
넣으면 그 구간은 정지한다. 이것이 홀드 샷이다. 카메라가 쉬지 않고 움직이면
어지럽고 diff 압축이 깨져 용량도 커진다. 마지막 와이드 샷에서 창 아래가
비어 보이면 1.1 배율쯤으로 살짝 당겨 빈 공간을 크롭하는 것도 요령이다.

### 3.7 반복 패턴

**타이핑.** 진행도로 문자열을 자른다.
```js
$('typed').textContent = MSG.slice(0, Math.floor(prog(t,T.type[0],T.type[1])*MSG.length));
```

**깜빡임.** 시간을 나눠 홀짝으로. `(Math.floor(t/400)%2)?0.15:1`

**스피너.** 각도든 글리프든 t의 함수로. `SPIN[Math.floor(t/80)%SPIN.length]`
CSS 애니메이션을 쓰면 seek이 순수하지 않게 되므로 금지다.

**등장.** 공통 헬퍼 하나면 충분하다.
```js
function rowIn(el,[a,b],t){
  const x=ease(prog(t,a,b));
  el.style.opacity=x; el.style.transform=`translateY(${8*(1-x)}px)`;
}
```

**2막 구성.** 내용이 화면 높이를 넘으면 스크롤 대신 막 전환이 깔끔하다.
같은 자리에 절대배치로 겹친 `.act` 컨테이너 두 개를 두고 크로스페이드한다.
터미널이 지워지고 다시 그려지는 것처럼 보여 자연스럽다.
```js
const clr=ease(prog(t,T.clear[0],T.clear[1]));
$('act1').style.opacity=1-clr; $('act2').style.opacity=clr;
```

### 3.8 튜닝 스위치

```
movie.html?play        실시간 미리보기 루프
movie.html?play&debug  현재 장면 이름과 초를 화면에 표시
```

이게 없으면 타이밍을 못 잡는다. 브라우저에 띄워놓고 T 숫자를 고치면 즉시
확인된다.

## 4. 촬영, shoot.mjs

seek(t)를 프레임 간격만큼 밀며 스크린샷을 찍는다. 포인트만 적는다.

- `--hide-scrollbars --force-device-scale-factor=1` 스크롤바 유입과 DPI 변동 차단
- `await page.evaluate(() => window.ready)` 폰트 준비 전에 찍으면 앞 프레임들이 다른 폰트로 나온다. sleep으로 때우지 말 것
- puppeteer-core는 브라우저를 내려받지 않는다. `CHROME` 환경변수 또는 후보 경로 목록으로 찾는다
- `FRAMES=90,150` 구간 렌더로 빠르게 확인한다. 전체를 매번 기다릴 필요 없다
- `MOVIE=other.html`로 장면 파일을 갈아끼울 수 있다

## 5. 조립, build.sh

```bash
ffmpeg -y -framerate 30 -i "$FRAMES/frame_%05d.png" \
  -vf "fps=$GIF_FPS,scale=$WIDTH:-1:flags=lanczos,split[s0][s1];\
[s0]palettegen=max_colors=$COLORS:stats_mode=diff[p];\
[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 "$OUT"
```

기본값 `WIDTH=1120 GIF_FPS=20 COLORS=96`. 30fps로 찍고 20fps로 떨구면 모션이
부드럽다. lanczos가 글자에 가장 선명하다. `stats_mode=diff`는 변하는 영역만
보고 팔레트를 뽑아 배경 고정 UI에 특히 효과적이고, `diff_mode=rectangle`이
용량 절감의 핵심이다.

**용량 레버는 넷이다. 가로폭, fps, 색 수, 길이.** 이 저장소는 11.7초 1120px
20fps 96색에서 4.8MB. GitHub README는 5MB 안쪽이 무난하고 10MB를 넘으면
모바일에서 버벅인다. 색 수를 96에서 80으로 줄여도 2% 남짓밖에 안 줄었다.
카메라 이동 구간이 전체 프레임을 바꿔 diff 압축을 깨는 것이 용량의 주범이라,
줄이고 싶으면 홀드 샷을 늘리는 쪽이 색 수보다 효과적이다.

## 6. 작업 순서

1. **스토리보드를 글로 먼저 쓴다.** 이 GIF는 "에이전트 Done 타이핑 → 훅 발동 →
   빨간 영수증 → 반송 → 수정 → 초록 영수증 → 통과 → 엔드 카드" 8비트다.
2. **실제 출력을 캡처한다.** 흉내 낼 대상의 텍스트, 색, 포맷을 확보한다.
3. **정지 화면부터 만든다.** 애니메이션 없이 마크업과 CSS만.
4. **T 표를 감으로 채우고 seek(t)를 요소별로 붙인다.** `?play`로 수시 확인.
5. **카메라는 마지막에 얹는다.** 내용 확정 전에 잡으면 계속 다시 잡는다.
6. **프로브 프레임으로 검수한다.** `FRAMES=140,140`처럼 장면당 한 장씩 뽑아
   PNG를 직접 열어 본다. 이 루프가 품질을 결정한다.
7. **전체 렌더 후 GIF를 뽑고 용량을 본다.** 크면 폭, 색, fps 순으로 줄인다.
8. **README에 넣고 실제 크기로 본다.** 1120px GIF가 README에서는 절반 크기로
   보인다. 안 읽히면 줌을 더 넣는다.
9. **하니스를 커밋한다.** `_frames/`만 gitignore. UI가 바뀌면 GIF도 다시
   찍어야 하는데 하니스가 없으면 처음부터 다시 만들어야 한다.

## 7. 흔한 함정

- CSS 애니메이션과 transition 금지. seek이 순수하지 않게 되고 스크린샷에 중간값이 찍힌다
- 폰트 로딩을 안 기다리면 앞 프레임들이 다른 폰트로 나온다
- 좌표 하드코딩 금지. measure()로 잰다
- 카메라 과다 이동은 멀미와 용량 폭증을 부른다. 홀드 샷을 넉넉히
- 데모용 폰트는 실제보다 키워도 된다. 이 장면의 터미널은 23px이다
- 이모지는 시스템 이모지 폰트로 렌더되므로 OS에 따라 모양이 다르다. macOS에서 찍은 것을 기준으로 삼는다
- npm 패키지에 하니스가 딸려가지 않게 package.json의 files 화이트리스트를 확인한다

## 8. 도구 선택

| 상황 | 도구 |
| --- | --- |
| UI 재현과 카메라 연출이 필요한 README GIF | 이 방식 |
| 순수 터미널 앱을 빠르게 | vhs |
| 터미널 세션 실녹화 | asciinema + agg |
| 나레이션 있는 긴 mp4, 오디오 동기화, 소셜용 영상 | Remotion |

Remotion은 이 방식과 원리가 같다. useCurrentFrame()이 seek(t)이고 Sequence가
T 표이고 interpolate가 보간 유틸이다. 장면 구성과 타이밍 표는 그대로 옮길 수
있으므로, mp4가 필요해지는 시점에 갈아타면 되고 지금 작업이 버려지지 않는다.
단 4인 이상 회사는 유료 라이선스가 필요하다.
