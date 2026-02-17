# virtuals-market-demo

Virtuals 스타일의 **에이전트 마켓 MVP**입니다.

- 프론트: 정적 페이지(GitHub Pages)
- 결제: Base Mainnet USDC 전송
- 백엔드(선택): 주문 생성/온체인 tx 검증/확정

## 현재 구현 상태

### 프론트
- 에이전트 마켓/상세/포트폴리오
- 지갑 연결(MetaMask 등 EVM)
- USDC 결제 트랜잭션 전송
- 결제 확정 대기(confirmations)
- 거래 히스토리
- 관리자 에이전트 등록
- Machine-readable state JSON

### 보안 하드닝
- CSP 적용
- 사용자 입력 sanitize + 길이 제한
- DOM API 렌더링 위주
- 구매 전 확인 다이얼로그
- 중복 결제 방지(처리 중 UI 잠금)
- Base 체인 검증

### 백엔드(신규)
- `POST /api/orders` : 주문 생성
- `POST /api/orders/:id/confirm` : tx hash 검증 후 주문 확정
- `GET /api/orders` : 주문 조회
- 검증 항목: from, USDC 컨트랙트 주소, transfer(to, amount), receipt status

---

## 로컬 실행

### 1) 프론트
```bash
cd /Volumes/sub/Davi_Workspace/02_Projects/virtuals-market-demo
python3 -m http.server 8787
```

### 2) 백엔드
```bash
cd /Volumes/sub/Davi_Workspace/02_Projects/virtuals-market-demo/server
cp .env.example .env
# .env의 MERCHANT_ADDRESS를 실제 수령 주소로 설정
npm install
npm start
```

기본 백엔드 포트: `8788`

---

## 프론트↔백엔드 연결

정적 호스팅(GitHub Pages)에서는 백엔드 URL을 브라우저 콘솔에서 1회 설정:

```js
localStorage.setItem('agent_market_backend_url', 'https://<your-backend-domain>')
location.reload()
```

(미설정 시 프론트 로컬 폴백 모드로 동작)

---

## 환경변수 (server/.env)

- `PORT` (기본 8788)
- `BASE_RPC_URL` (기본 https://mainnet.base.org)
- `USDC_BASE_ADDRESS` (Base USDC)
- `MERCHANT_ADDRESS` (USDC 수령 주소)
- `USDC_MICRO_PER_VIRTUAL` (기본 50000 = 0.05 USDC)
- `ORDER_TTL_SECONDS` (기본 900)

---

## 프로덕션 권장 추가사항
- DB(PostgreSQL) 전환
- 서버 서명 기반 주문 토큰
- idempotency key
- webhook/queue 기반 확정 처리
- 관리자 인증 및 role 분리
