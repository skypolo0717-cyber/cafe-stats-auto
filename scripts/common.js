// 공용 로직: 매일 자동 실행되는 scripts/check.js 와, 결과를 보여주는 웹페이지(../app.js)
// 양쪽에서 같은 계산 방식을 쓰도록 정리한 파일입니다.
// (Node에서는 module.exports로, 브라우저에서는 그냥 전역 함수로 쓸 수 있게 작성)

// ---------- 숫자 파싱 ----------
function parseCountNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, "").trim();
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

// "1,044만" / "74.4만" 같은 표기를 실제 숫자로 변환 (반올림)
function parseManNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, "").trim();
  const m = cleaned.match(/^([\d.]+)\s*만$/);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : Math.round(n);
}

// ---------- 카페ID / 별명 처리 ----------
function extractClubIdFromInput(input) {
  input = (input || "").trim();
  if (/^\d+$/.test(input)) return input;
  let m = input.match(/[?&]search\.clubid=(\d+)/);
  if (m) return m[1];
  m = input.match(/[?&]clubid=(\d+)/i);
  if (m) return m[1];
  m = input.match(/cafeId=(\d+)/i);
  if (m) return m[1];
  m = input.match(/cafes\/(\d+)/);
  if (m) return m[1];
  return null;
}

function extractAliasFromInput(input) {
  input = (input || "").trim();
  let m = input.match(/cafe\.naver\.com\/([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]+$/.test(input)) return input;
  return null;
}

// ---------- 날짜/시간 (KST 기준) ----------
function getKstDateString(date = new Date()) {
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(dateFromStr, dateToStr) {
  const from = new Date(`${dateFromStr}T00:00:00+09:00`);
  const to = new Date(`${dateToStr}T00:00:00+09:00`);
  return Math.round((to - from) / 86400000);
}

// ---------- HTML 파싱 (카페 활동 표에서 숫자 추출) ----------
// html: CafeProfileView.nhn 응답을 EUC-KR -> UTF-8로 디코딩한 문자열
function parseCafeProfileHtml(html, clubId) {
  const nameMatch = html.match(/카페\s*이름<\/th>\s*<td>([\s\S]*?)<\/td>/);
  const name = nameMatch ? nameMatch[1].replace(/<[^>]*>/g, "").trim() : null;

  const memberMatch = html.match(/카페멤버\s*:\s*<span class="count">([\d,]+)<\/span>/);
  const postMatch = html.match(/전체\s*게시글\s*:\s*<span class="count">([\d,]+)<\/span>/);
  const visitorMatch = html.match(/총\s*방문자\s*:\s*<span class="count">([\d,]+)<\/span>/);
  const rankMatch = html.match(/txt_rank">([^<]+)</);
  const citationMatch = html.match(/누적\s*인용수\s*:\s*([\d,.]+만)/);

  if (!memberMatch || !visitorMatch) {
    return { ok: false, clubId };
  }

  return {
    ok: true,
    clubId,
    name,
    memberCount: parseCountNumber(memberMatch[1]),
    postCount: postMatch ? parseCountNumber(postMatch[1]) : null,
    visitorCount: parseCountNumber(visitorMatch[1]),
    rank: rankMatch ? rankMatch[1].trim() : null,
    citationCount: citationMatch ? parseManNumber(citationMatch[1]) : null,
  };
}

// ---------- 표시용 데이터 계산 (증감 + 경과일) ----------
function computeRows(historyForCafe) {
  const hist = (historyForCafe || [])
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rows = [];
  for (let i = 0; i < hist.length; i++) {
    const cur = hist[i];
    const prev = i > 0 ? hist[i - 1] : null;
    rows.push({
      date: cur.date,
      memberCount: cur.memberCount,
      visitorCount: cur.visitorCount,
      citationCount: cur.citationCount,
      baseDate: prev ? prev.date : null,
      daysElapsed: prev ? daysBetween(prev.date, cur.date) : null,
      newMembers:
        prev && prev.memberCount != null && cur.memberCount != null
          ? cur.memberCount - prev.memberCount
          : null,
      newVisitors:
        prev && prev.visitorCount != null && cur.visitorCount != null
          ? cur.visitorCount - prev.visitorCount
          : null,
      newCitations:
        prev && prev.citationCount != null && cur.citationCount != null
          ? cur.citationCount - prev.citationCount
          : null,
    });
  }
  return rows.reverse(); // 최신순
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseCountNumber,
    parseManNumber,
    extractClubIdFromInput,
    extractAliasFromInput,
    getKstDateString,
    daysBetween,
    parseCafeProfileHtml,
    computeRows,
  };
}
