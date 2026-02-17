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

## 다음 확장 아이디어
1. 지갑 연결(Base)
2. 실제 결제(USDC/$VIRTUAL) 플로우 연동
3. Agent 상세 페이지 + 성과지표 대시보드
4. 크리에이터 런치 온보딩(수수료/토큰 분배 설정)
5. 거래 로그/수익 정산 백엔드(Node + DB)
