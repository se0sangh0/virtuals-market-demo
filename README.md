# virtuals-market-demo

Virtuals 스타일의 **에이전트 마켓 MVP 예시**입니다.

## 포함 기능
- 에이전트 카드 목록
- 구매(잔액 차감 + 포트폴리오 반영)
- 월 수익 시뮬레이터(유저 수/ARPU/비용률)

## 실행 방법
프로젝트 폴더에서:

```bash
cd /Volumes/sub/Davi_Workspace/02_Projects/virtuals-market-demo
python3 -m http.server 8787
```

브라우저에서:

```text
http://localhost:8787
```

## 보안 하드닝(적용됨)
- CSP(Content-Security-Policy) 적용
- 사용자 입력(관리자 등록 폼) 길이 제한 + 특수문자 필터링
- `innerHTML` 기반 렌더링 최소화(DOM API 위주)
- 구매 전 확인 다이얼로그 추가
- Base Mainnet 체인 검증 후 구매 허용

## USDC 결제(적용됨)
- 네트워크: Base Mainnet (`0x2105`)
- 토큰: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- 결제 방식: `eth_sendTransaction`으로 USDC 컨트랙트 `transfer(address,uint256)` 호출
- 정산 지갑 주소를 UI에서 설정 후 저장하여 사용

> 주의: 이 데모는 결제 성공 시 프론트 상태를 업데이트합니다. 프로덕션에서는 백엔드에서 tx receipt 검증/정산 확정 로직이 반드시 필요합니다.

## 다음 확장 아이디어
1. 트랜잭션 receipt 확인 + 확정(confirmation) 후 자산 지급
2. 서명 기반 주문(오프체인 주문 + 온체인 정산)
3. 거래 로그/수익 정산 백엔드(Node + DB)
4. 감사 로그/권한 레벨(운영자·빌더·사용자) 분리
