# 네이버 카페 통계 트래커 (자동)

매일 오전 9시(KST)에 GitHub Actions가 자동으로 등록된 카페들의 회원수·방문자수·누적 인용수를
조사해서 `data/history.json`에 기록합니다. PC나 휴대폰을 켜둘 필요가 없습니다.

결과는 GitHub Pages로 배포된 웹페이지에서 언제든 확인하고, 엑셀로도 내보낼 수 있습니다.

## 카페 추가/삭제하는 법

`cafes.json` 파일을 열어서 카페를 추가/삭제하세요. 예:

```json
[
  {
    "input": "https://cafe.naver.com/20daelee",
    "clubId": "20508270",
    "alias": "20daelee",
    "name": null
  },
  {
    "input": "https://cafe.naver.com/다른카페별명"
  }
]
```

- `input`만 있고 `clubId`가 없으면, 다음 자동 실행 때 스크립트가 알아서 clubId를 찾아서
  채워 넣고 다시 커밋합니다.
- 카페 링크 대신 clubId(숫자)를 알고 있다면 바로 `clubId` 필드에 적어도 됩니다.
- 카페를 지우려면 배열에서 해당 항목을 삭제하면 됩니다. (기록은 `data/history.json`에
  clubId 기준으로 남아있으니, 필요하면 그쪽도 같이 정리하세요.)

## 수동으로 바로 조사해보고 싶을 때

저장소의 GitHub 페이지에서 **Actions → 카페 수치 매일 자동 조사 → Run workflow** 버튼을
누르면 스케줄과 상관없이 즉시 실행됩니다.

## 로컬에서 테스트하는 법

```bash
npm install
npm run check
```

## 동작 원리

- `cafe.naver.com/CafeProfileView.nhn?clubid=...` 페이지에 로그인 없이 접속해서
  공개된 "카페 활동" 수치(회원수/방문자수/인용수)만 읽어옵니다.
- 별도 로그인, 쿠키, 브라우저 자동화 탐지 우회 없이 표준 HTTP 요청만 사용합니다.
