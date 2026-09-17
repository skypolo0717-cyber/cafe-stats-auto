// 조사 결과를 구글시트의 그룹별 탭(gid)에 한 줄씩 누적 기록합니다.
// GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_SHEET_ID 환경변수(GitHub Secrets)가 없으면
// 아무 것도 하지 않고 조용히 건너뜁니다 (로컬 테스트 시 구글시트 없이도 동작).

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

function getSheetsClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  const { google } = require("googleapis");
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function findSheetTitleByGid(sheets, spreadsheetId, gid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find((s) => String(s.properties.sheetId) === String(gid));
  if (!sheet) throw new Error(`gid=${gid} 에 해당하는 탭을 찾을 수 없습니다`);
  return sheet.properties.title;
}

async function ensureHeader(sheets, spreadsheetId, title) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A1:A1`,
  });
  if (!res.data.values || !res.data.values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

// rowsByGid: { [gid]: row[][] } - gid별로 그 탭에 추가할 행들
async function appendRowsByGid(rowsByGid) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = getSheetsClient();

  if (!sheets || !spreadsheetId) {
    console.log("[sheets] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_SHEET_ID 미설정 - 구글시트 기록 생략");
    return;
  }

  for (const [gid, rows] of Object.entries(rowsByGid)) {
    if (!rows.length) continue;
    try {
      const title = await findSheetTitleByGid(sheets, spreadsheetId, gid);
      await ensureHeader(sheets, spreadsheetId, title);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${title}!A:I`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
      console.log(`[sheets] "${title}" 탭(gid=${gid})에 ${rows.length}개 행 기록 완료`);
    } catch (e) {
      console.error(`[sheets] gid=${gid} 기록 실패:`, e.message);
    }
  }
}

module.exports = { appendRowsByGid };
