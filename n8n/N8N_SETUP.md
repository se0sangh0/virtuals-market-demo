# n8n 연동 가이드 (Virtuals Market Demo)

이 가이드는 Render 없이 n8n으로 주문/검증 API를 대체하는 방법입니다.

## 0) 전제
- n8n 접속 가능: `http://localhost:5678`
- 워크플로우 파일:
  - `n8n/workflows/virtuals-orders-create.json`
  - `n8n/workflows/virtuals-orders-confirm.json`

## 1) n8n에 환경변수 추가 (선택)
현재 워크플로우는 기본값 하드코딩으로도 동작해요.
(필요하면 환경변수 방식으로 확장 가능)

### CORS 권장
GitHub Pages에서 직접 호출하려면 CORS 필요:
- `N8N_CORS_ALLOW_ORIGIN=*`

> 보안상 실제 운영은 `*` 대신 GitHub Pages 도메인만 허용 추천.

## 2) 워크플로우 Import
1. n8n UI 접속
2. Workflows → Import from file
3. 위 두 JSON 파일 각각 import
4. 둘 다 **Active**로 켜기

## 3) Webhook URL 확인
활성화 후 URL은 보통 다음 형태:
- Create: `http://localhost:5678/webhook/api/orders`
- Confirm: `http://localhost:5678/webhook/api/orders-confirm`

## 4) 프론트 연결
브라우저 콘솔(F12)에서 1회 실행:

```js
localStorage.setItem('agent_market_backend_url', 'http://localhost:5678/webhook')
location.reload()
```

## 5) 동작 테스트
1. 마켓에서 지갑 연결
2. 정산 지갑 주소 저장(백엔드 사용 시 없어도 되지만 권장)
3. 구매 클릭
4. tx 승인
5. tx 히스토리에 `BUY_USDC_CONFIRMED` 나오면 성공

## 6) 트러블슈팅
- `api_error_404`: webhook path 또는 workflow inactive
- CORS 에러: `N8N_CORS_ALLOW_ORIGIN` 설정/재시작 필요
- `merchant_address_required`: 프론트에서 정산 지갑 미입력
- `tx_not_found_or_pending`: 아직 체인 반영 전 (잠시 후 재시도)
- `order_expired`: 주문 생성 후 TTL(기본 15분) 경과
