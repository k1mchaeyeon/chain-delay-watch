# 연쇄 지연 워치 (샘플 대시보드)

- `site/` : 화면 파일 (index, highway, airport)
- `netlify/functions/live.mjs` : 실시간 항공기 위치 중계 함수. `/api/live` 주소로 열리고 adsb.lol(ODbL) 공개 데이터를 받아 전달한다. 키가 필요 없다.
- `netlify.toml` : Netlify 설정 (게시 폴더 `site`, 함수 폴더 `netlify/functions`)

## 배포
1. 이 폴더를 깃허브 저장소(비공개 가능)에 올린다.
2. Netlify에서 Add new site → Import an existing project → GitHub → 저장소 선택 → Deploy.
3. 배포된 주소의 `/airport.html` → 실시간 지도 탭 → "실제 ADS-B 위치 불러오기".

터미널로 올리려면 이 폴더에서 `npx netlify-cli deploy --prod` 를 실행한다.
