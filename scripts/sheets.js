// 조사 결과를 구글시트에 한 줄씩 누적 기록합니다.
// GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_SHEET_ID 환경변수(GitHub Secrets)가 없으면
// 아무 것도 하지 않고 조용히 건너뜁니다 (로컬 테스트 시 구글시트 없이도 동작).

const SHEET_NAME = "기록";
const HEADER = [
  "날짜",
  "카페",
  "총 회원수",
  "가입 증감",
  "총 방문자",
  "방문자 증감",
  "누적 인용수",
  "인용 증감",
  "경과일",
];

async function ensureSheetWithHeader(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s) => s.properties.title === SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    });
  }

  const existingHeader = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:A1`,
  });
  if (!existingHeader.data.values || !existingHeader.data.values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

async function appendRows(rows) {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!keyJson || !spreadsheetId) {
    console.log("[sheets] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_SHEET_ID 미설정 - 구글시트 기록 생략");
    return;
  }
  if (!rows.length) return;

  const { google } = require("googleapis");
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await ensureSheetWithHeader(sheets, spreadsheetId);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });

  console.log(`[sheets] 구글시트에 ${rows.length}개 행 기록 완료`);
}

module.exports = { appendRows };
