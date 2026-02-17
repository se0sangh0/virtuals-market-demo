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

## 다음 확장 아이디어
1. 실제 결제(USDC/$VIRTUAL) 플로우 연동
2. 서명 기반 주문(오프체인 주문 + 온체인 정산)
3. 거래 로그/수익 정산 백엔드(Node + DB)
4. 감사 로그/권한 레벨(운영자·빌더·사용자) 분리
