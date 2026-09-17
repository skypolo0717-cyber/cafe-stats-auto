// 매일 GitHub Actions가 실행하는 스크립트.
// cafes.json에 등록된 카페들을 순서대로 조회해서 data/history.json에 오늘자 기록을 남깁니다.

const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const {
  extractClubIdFromInput,
  extractAliasFromInput,
  getKstDateString,
  parseCafeProfileHtml,
} = require("./common.js");

const ROOT = path.join(__dirname, "..");
const CAFES_PATH = path.join(ROOT, "cafes.json");
const HISTORY_PATH = path.join(ROOT, "data", "history.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return iconv.decode(buf, "euc-kr");
}

// 별명(alias) 형태의 카페 링크를 숫자 clubId로 변환
async function resolveClubId(input) {
  const direct = extractClubIdFromInput(input);
  if (direct) return direct;

  const alias = extractAliasFromInput(input);
  if (!alias) throw new Error(`카페 링크를 인식하지 못했습니다: ${input}`);

  const html = await fetchText(`https://cafe.naver.com/${alias}`);
  const m = html.match(/clubid=(\d+)/);
  if (!m) throw new Error(`카페ID를 찾지 못했습니다: ${input}`);
  return { clubId: m[1], alias };
}

// 카페 활동 수치 조회 (로그인 불필요 — 이 페이지가 iframe으로 내려받는 요청이라는
// 표준 Fetch Metadata 헤더만 정직하게 실어 보내면 공개된 수치가 그대로 내려옵니다)
async function fetchCafeProfile(clubId, alias) {
  const referer = alias ? `https://cafe.naver.com/${alias}` : "https://cafe.naver.com/";
  const html = await fetchText(`https://cafe.naver.com/CafeProfileView.nhn?clubid=${clubId}`, {
    Referer: referer,
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
  });
  return parseCafeProfileHtml(html, clubId);
}

async function main() {
  const cafes = readJson(CAFES_PATH, []);
  const history = readJson(HISTORY_PATH, {});
  const today = getKstDateString();

  if (!cafes.length) {
    console.log("cafes.json에 등록된 카페가 없습니다. 종료합니다.");
    return;
  }

  let changed = false;

  for (const cafe of cafes) {
    try {
      let clubId = cafe.clubId;
      let alias = cafe.alias;
      if (!clubId) {
        const resolved = await resolveClubId(cafe.input);
        clubId = resolved.clubId;
        alias = resolved.alias;
        cafe.clubId = clubId;
        if (alias) cafe.alias = alias;
        changed = true;
      }

      const profile = await fetchCafeProfile(clubId, alias || extractAliasFromInput(cafe.input));

      if (!profile.ok) {
        console.error(`[실패] ${cafe.name || cafe.input} (clubId=${clubId}) - 카페 활동 표를 찾지 못함`);
        continue;
      }

      if (profile.name) cafe.name = profile.name;
      cafe.lastChecked = today;

      if (!history[clubId]) history[clubId] = [];
      const hist = history[clubId];
      const idx = hist.findIndex((h) => h.date === today);
      const entry = {
        date: today,
        checkedAt: new Date().toISOString(),
        memberCount: profile.memberCount,
        visitorCount: profile.visitorCount,
        citationCount: profile.citationCount,
      };
      if (idx >= 0) hist[idx] = entry;
      else hist.push(entry);
      hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      console.log(
        `[성공] ${cafe.name} - 회원 ${profile.memberCount}, 방문자 ${profile.visitorCount}, 인용 ${profile.citationCount ?? "-"}`
      );
      changed = true;

      // 네이버에 너무 빠르게 연속 요청하지 않도록 살짝 간격을 둡니다.
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.error(`[에러] ${cafe.name || cafe.input}:`, e.message);
    }
  }

  if (changed) {
    writeJson(CAFES_PATH, cafes);
    writeJson(HISTORY_PATH, history);
    console.log("cafes.json / data/history.json 갱신 완료");
  } else {
    console.log("변경 사항 없음");
  }
}

main().catch((e) => {
  console.error("스크립트 실행 실패:", e);
  process.exit(1);
});
