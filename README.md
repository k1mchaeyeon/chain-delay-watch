# 연쇄 지연 워치

인천공항 출발편의 지연이 같은 기체의 다음 편으로 번지는 모습을 보여 주는 대시보드.

- 배포 주소: https://chain-delay-watch.vercel.app/airport
- `site/` : 화면 파일 (index, highway, airport)
- `netlify/functions/*.mjs` : 데이터 중계 함수 (Netlify 와 Vercel 이 같은 코드를 쓴다)
- `api/*.js`, `vercel.json` : Vercel 진입점과 설정
- `netlify.toml` : Netlify 설정

## 중계 주소

| 주소 | 데이터 | 키 |
|---|---|---|
| `/api/live` | 항공기 실시간 위치 (adsb.lol, ODbL) | 없음 |
| `/api/flights` | 인천국제공항공사 항공기 운항 현황 상세 조회 | `DATA_GO_KR_KEY` |
| `/api/kac` | 한국공항공사 실시간 항공기 운항정보 조회 (출발편, 공항별 집계) | `DATA_GO_KR_KEY` |
| `/api/kac?what=routes` | 한국공항공사 노선별 소요시간 및 거리 | `DATA_GO_KR_KEY` |
| `/api/weather` | 인천공항 METAR·TAF (aviationweather.gov) | 없음 |
| `/api/route?cs=콜사인` | 콜사인별 노선 (adsbdb.com) | 없음 |

## 배포

1. Vercel 에서 이 저장소를 Import 한다.
2. Settings → Environment Variables 에 `DATA_GO_KR_KEY` (공공데이터포털 일반 인증키)를 넣는다. 키는 저장소나 채팅에 적지 않는다.
3. 환경 변수를 바꾼 뒤에는 다시 배포해야 적용된다.

## 아직 샘플인 부분

- "예측은 얼마나 맞았나", "예측에 영향을 준 요인" 차트 (모델 학습 전)
- 남은 편의 예상 지연은 학습한 모델이 아니라 단순 계산 (앞 편 도착 시각 + 최소 지상 시간 50분)

## 매일 자료 수집 (모델 학습용)

- `.github/workflows/collect.yml` 이 매일 00:20과 12:20(서울)에 `scripts/collect.mjs` 를 돌려 전날 자료를 `data` 브랜치에 쌓는다.
- `icn_flights/날짜.json` 인천공항 출발·도착 전체, `kac_departures/날짜.json` 한국공항공사 14개 공항 출발, `icn_weather/날짜_시.json` 인천공항 METAR 최근 30시간(하루 두 번, 겹침 있음), `kac_routes.json` 노선별 거리·소요시간.
- 인천공항 API 는 3일 전까지만 조회되므로 하루라도 빠지면 Actions 탭에서 수동 실행(days_back 최대 3)으로 메운다.
