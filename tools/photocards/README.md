# 포토카드 검수 도구

새 영상이 쌓이면 이 순서로 포토카드 후보를 만들고 직접 검수해서 `data/cards.json`에 반영한다.
(이 폴더에서 실행, Node.js와 Chrome 필요, `npm i puppeteer-core@22.15.0`)

1. `node ytall.js` → 채널 전체 영상 목록 `ytall.json`
2. `node run.js` → 영상마다 대표 썸네일·장면 3장의 얼굴 분석 `faces.json` (몇 분 걸림)
3. `node select.js` → 자동 판정 `decisions.json`, 검수 화면용 데이터 `review-data.json`
4. `node review-server.js` → http://localhost:5577 에서 넣기/빼기 검수 (`review.json`에 저장)
5. 검수 결과로 `data/cards.json`을 다시 만듦

`review.json`은 2026-10-29 첫 검수 기록(292장 선택). 자동 기준(얼굴 잘림·흐림 등)은
사람이 고른 것과 잘 맞지 않아서, 최종 선택은 항상 사람이 한다.
