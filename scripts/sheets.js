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

// 숫자 컬럼(C~H: 총회원수/가입증감/총방문자/방문자증감/누적인용수/인용증감)에
// 1,000 단위 콤마 서식을 입혀서 "1000000" 대신 "1,000,000"으로 보이게 합니다.
function numberFormatRequest(sheetId, startRow, endRow, startCol, endCol, pattern) {
  return {
    repeatCell: {
      range: {
        sheetId: Number(sheetId),
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern } } },
      fields: "userEnteredFormat.numberFormat",
    },
  };
}

async function applyCommaFormat(sheets, spreadsheetId, gid, updatedRange) {
  const m = updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)/);
  if (!m) return;
  const startRow = parseInt(m[1], 10) - 1;
  const endRow = parseInt(m[2], 10);
  const plain = "#,##0";
  const signed = "+#,##0;-#,##0;0";

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        numberFormatRequest(gid, startRow, endRow, 2, 3, plain), // 총 회원수
        numberFormatRequest(gid, startRow, endRow, 3, 4, signed), // 가입 증감
        numberFormatRequest(gid, startRow, endRow, 4, 5, plain), // 총 방문자
        numberFormatRequest(gid, startRow, endRow, 5, 6, signed), // 방문자 증감
        numberFormatRequest(gid, startRow, endRow, 6, 7, plain), // 누적 인용수
        numberFormatRequest(gid, startRow, endRow, 7, 8, signed), // 인용 증감
      ],
    },
  });
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
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${title}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
      const updatedRange = appendRes.data.updates && appendRes.data.updates.updatedRange;
      if (updatedRange) await applyCommaFormat(sheets, spreadsheetId, gid, updatedRange);
      console.log(`[sheets] "${title}" 탭(gid=${gid})에 ${rows.length}개 행 기록 완료`);
    } catch (e) {
      console.error(`[sheets] gid=${gid} 기록 실패:`, e.message);
    }
  }
}

module.exports = { appendRowsByGid };
