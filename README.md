# 오피스 로얄

회사에서 살아남는 배틀로얄 웹게임. 고과가 체력이고 서류가 무기다. 아래층부터 층이 폐쇄되고, 최후의 1인만 7층 대표실에 들어간다.

- 고과 50에서 시작, 0이 되면 권고사직
- 최고 고과에 따라 승진: 인턴 → 대리(60) → 팀장(75) → 임원(90). 직급이 오를수록 공격이 세진다(1 / 1.3 / 1.6 / 2배)
- 동료를 처리하면 고과 +10, 윗사람이면 +6 추가
- 부장님 시야에 들어가면 먼저 인사. 임원이 되면 부장님이 먼저 인사한다
- 점심시간엔 옥상에서 흡연 동맹 난투전, 하늘에서 보급품이 떨어진다
- **혼자 하기**: 나 + 봇 19명 · **같이 하기**: 방 코드로 친구와 최대 8명, 남는 자리는 봇

플레이: https://office-royale.bb-dochi.workers.dev

## 조작

| PC | 폰 |
|---|---|
| WASD 이동 · Shift 달리기 | 왼쪽 드래그 이동 (끝까지 밀면 달리기) |
| Space / 마우스 클릭 던지기 | 오른쪽 던지기 버튼 |
| E 상호작용 | 상호작용 버튼 |
| F / 우클릭 공격 아이템 | 아이템 칸 탭 |
| Q 팀장 스킬 · Tab 지도 | 스킬 버튼 · 건물 단면 탭 |

## 폴더 구조

```
public/                 정적 사이트 (Cloudflare Pages가 그대로 서빙)
  index.html
  css/game.css
  js/sim/               게임 규칙. DOM, three.js를 쓰지 않음 → 서버(Worker)와 Node에서도 돌아감
    00-core.js          공용 함수, 화면과 통신하는 UI 훅(기본값은 아무것도 안 함)
    10-building.js      층 구조, 아이템, 직급 표
    20-geometry.js      길찾기, 시야·사선 판정
    30-state.js         새 게임, 고과/피해
    40-npc.js           부장님, 대표님, 청소 아주머니, 신입, 택배, 커피 카트
    50-actions.js       던지기, 아이템, 스킬, 이동
    60-bots.js          봇 AI
    70-events.js        정전, 화재, 감사, 점심 옥상 등 이벤트
    80-step.js          한 프레임 진행 (플레이어 입력은 actor.input으로만 받음)
    90-net.js           온라인 방용: 여러 명 시작, 입력·명령 적용, 상태 스냅샷 (소켓·타이머 없음)
  js/client/            브라우저 전용: 3D 렌더(three.js), HUD, 입력, 시작 화면
    05-net.js           온라인 접속, 스냅샷으로 화면용 상태 복원, ACT(행동을 규칙/서버로 보내는 곳)
server/                 온라인 대전용 Cloudflare Worker + Durable Object
  src/room.js           방 로직(대기실·방장·시작·틱·스냅샷 전송). 로컬 서버와 Worker가 같이 씀
  src/index.js          Worker: public/ 서빙 + 방마다 Durable Object 하나
tools/
  dev-server.mjs        로컬 서버: public/ 서빙 + 멀티 방 (의존성 없음)
  build-server.mjs      규칙 파일을 Worker용 server/src/sim.gen.js로 묶기 (wrangler가 자동 실행)
  headless.mjs          브라우저 없이 규칙 파일만으로 게임을 끝까지 돌려보는 테스트
  build-single.mjs      public/을 HTML 한 파일로 묶기
```

스크립트는 번호 순서대로 불러오는 일반 `<script>`이고 같은 전역 범위를 공유한다. 빌드 도구가 필요 없다.

## 로컬에서 실행

```
node tools/dev-server.mjs 8080
```

브라우저에서 http://localhost:8080 접속. 혼자 하기와 같이 하기 모두 된다.

- 같이 하기 → 방 만들기 → 초대 링크(`?room=코드`)를 친구에게 보내거나 코드를 알려준다. 방장이 시작하기를 누르면 시작.
- 같은 Wi-Fi의 친구는 이 PC의 IP로 접속하면 된다(예: `http://192.168.0.5:8080`). Windows 방화벽이 물으면 허용.
- 정적 서버(`python -m http.server` 등)로 띄우면 혼자 하기만 된다.
- 게임 중에 나가면 그 캐릭터는 봇이 이어받는다. 끝나면 8초 뒤 모두 대기실로 돌아간다.

## 테스트

```
node tools/headless.mjs 5
```

규칙 파일만 불러서 5판을 끝까지 돌리고 판 길이, 승자, 처치 수, 최종 직급 분포를 출력한다. 서버에서 그대로 쓸 수 있는지(DOM 의존이 없는지)도 이걸로 확인된다.

## 배포: Cloudflare Pages (무료, 혼자 하기만)

1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git
2. 이 저장소 선택
3. Build command: 비워둠 · Build output directory: `public`
4. Save and Deploy → `*.pages.dev` 주소가 생긴다. 이후 main에 push할 때마다 자동 배포

## 온라인 대전 (Cloudflare Workers + Durable Objects)

`server/`의 Worker가 게임 페이지(`public/`)와 방을 같이 서빙한다. 방 하나가 Durable Object 하나이고, 서버가 규칙 파일을 돌린다.

```
cd server
npx wrangler dev        # 로컬: http://localhost:8787
npx wrangler deploy     # 배포: https://office-royale.bb-dochi.workers.dev (Cloudflare 로그인 필요)
```

규칙·화면 코드를 바꾼 뒤 `server/`에서 `npx wrangler deploy`를 다시 하면 반영된다(규칙 묶기는 자동).

배포하면 그 주소 하나로 혼자 하기·같이 하기 둘 다 된다. 다른 곳(예: Pages)에 올린 페이지에서 붙으려면 `?server=호스트` 를 붙인다.

- 무료 플랜에서는 SQLite 저장소를 쓰는 Durable Object만 쓸 수 있고, 하루 요청 10만 건 같은 한도가 있다. 한도를 넘으면 그날은 요청이 실패한다.
- 클라이언트는 입력(`{vx, vy, run, fire, aim}`)과 행동 명령만 보내고, 서버가 `public/js/sim`을 그대로 돌려(초당 30틱) 초당 10회 상태를 보낸다(한 번에 약 10KB). 규칙 코드를 화면 코드와 분리해 둔 이유가 이것.
- 지금은 Hibernation API를 쓰지 않는다. 방 상태를 메모리에 두는 대신, 누군가 접속해 있는 동안은 Durable Object 실행 시간이 계속 잡힌다.

로컬에서 서버 뼈대 띄우기: `cd server && npx wrangler dev`

참고: [Durable Objects 요금·무료 한도](https://developers.cloudflare.com/durable-objects/platform/pricing)
