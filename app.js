let state = { cafes: [], history: {} };

async function loadData() {
  const bust = `?t=${Date.now()}`;
  const [cafesRes, historyRes] = await Promise.all([
    fetch(`cafes.json${bust}`),
    fetch(`data/history.json${bust}`),
  ]);
  state.cafes = await cafesRes.json();
  state.history = await historyRes.json();
}

function latestRow(clubId) {
  const rows = computeRows(state.history[clubId] || []);
  return rows[0] || null;
}

function fmt(n) {
  return n == null ? "-" : n.toLocaleString("ko-KR");
}
function fmtDelta(n) {
  if (n == null) return "-";
  return (n > 0 ? "+" : "") + n.toLocaleString("ko-KR");
}
function fmtDeltaWithDays(n, days) {
  if (n == null) return "-";
  const daysText = days != null ? ` (${days}일)` : "";
  return fmtDelta(n) + daysText;
}

function render() {
  const tbody = document.getElementById("compareBody");
  tbody.innerHTML = "";

  const citationHeader = document.getElementById("compareCitationHeader");
  const citationDeltaHeader = document.getElementById("compareCitationDeltaHeader");
  const hasCitationAny = state.cafes.some((c) => {
    const r = latestRow(c.clubId);
    return r && r.citationCount != null;
  });
  citationHeader.hidden = !hasCitationAny;
  citationDeltaHeader.hidden = !hasCitationAny;

  if (!state.cafes.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "empty";
    td.style.textAlign = "center";
    td.textContent = "등록된 카페가 없습니다. cafes.json 파일에 카페를 추가해주세요.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const cafe of state.cafes) {
    const r = latestRow(cafe.clubId);
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.className = "compare-name";
    const displayName = cafe.displayName || cafe.name || `카페(${cafe.clubId})`;
    nameTd.textContent = displayName;
    nameTd.title = cafe.name || displayName;

    const memberTd = document.createElement("td");
    memberTd.textContent = r ? fmt(r.memberCount) : "-";
    const newMemberTd = document.createElement("td");
    newMemberTd.className = "delta";
    newMemberTd.textContent = r ? fmtDeltaWithDays(r.newMembers, r.daysElapsed) : "-";

    const visitorTd = document.createElement("td");
    visitorTd.textContent = r ? fmt(r.visitorCount) : "-";
    const newVisitorTd = document.createElement("td");
    newVisitorTd.className = "delta";
    newVisitorTd.textContent = r ? fmtDeltaWithDays(r.newVisitors, r.daysElapsed) : "-";

    tr.appendChild(nameTd);
    tr.appendChild(memberTd);
    tr.appendChild(newMemberTd);
    tr.appendChild(visitorTd);
    tr.appendChild(newVisitorTd);

    if (hasCitationAny) {
      const citTd = document.createElement("td");
      citTd.textContent = r ? fmt(r.citationCount) : "-";
      const citDeltaTd = document.createElement("td");
      citDeltaTd.className = "delta";
      citDeltaTd.textContent = r ? fmtDeltaWithDays(r.newCitations, r.daysElapsed) : "-";
      tr.appendChild(citTd);
      tr.appendChild(citDeltaTd);
    }

    const lastTd = document.createElement("td");
    lastTd.className = "cafe-last";
    lastTd.textContent = r ? r.date : "-";

    tr.appendChild(lastTd);
    tbody.appendChild(tr);
  }
}

const COMPARE_EXCEL_HEADER = [
  "카페",
  "총 회원수",
  "가입 증감",
  "총 방문자",
  "방문자 증감",
  "누적 인용수",
  "인용 증감",
  "기준일",
  "경과일",
];

document.getElementById("exportAllBtn").addEventListener("click", () => {
  if (!state.cafes.length) return;
  try {
    const aoa = [COMPARE_EXCEL_HEADER];
    for (const cafe of state.cafes) {
      const r = latestRow(cafe.clubId);
      aoa.push([
        cafe.displayName || cafe.name || `카페(${cafe.clubId})`,
        r ? r.memberCount : null,
        r ? r.newMembers : null,
        r ? r.visitorCount : null,
        r ? r.newVisitors : null,
        r ? r.citationCount : null,
        r ? r.newCitations : null,
        r ? r.date : null,
        r ? r.daysElapsed : null,
      ]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "카페 비교");
    XLSX.writeFile(wb, `카페통계_전체비교_${getKstDateString()}.xlsx`);
  } catch (e) {
    console.error("[cafe-stats] 엑셀 내보내기 실패", e);
    alert("엑셀 내보내기 중 오류가 발생했습니다: " + e.message);
  }
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadData();
  render();
});

(async function init() {
  await loadData();
  render();
})();
