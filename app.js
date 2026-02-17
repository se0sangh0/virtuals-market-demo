const STORE_KEY = "agent_market_demo_v2";

const seedAgents = [
  { id: "a1", name: "SEO Writer Agent", type: "Content", desc: "키워드 리서치 + 블로그 초안 자동 작성", price: 120, owners: 214, rating: 4.6, mrr: 1800 },
  { id: "a2", name: "CS Auto-Reply Agent", type: "Support", desc: "고객문의 분류/응답/티켓 요약 자동화", price: 180, owners: 132, rating: 4.8, mrr: 2300 },
  { id: "a3", name: "Market Research Agent", type: "Analytics", desc: "경쟁사/가격/트렌드 리포트 생성", price: 240, owners: 89, rating: 4.5, mrr: 2700 }
];

const state = {
  walletConnected: false,
  walletAddress: "-",
  balance: 1000,
  agents: [...seedAgents],
  holdings: {},
  txs: [],
  selectedAgentId: null
};

const $ = (id) => document.getElementById(id);

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (_) {}
}

function persistState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  renderMachineState();
}

function format(n) { return Number(n).toLocaleString(); }
function now() { return new Date().toLocaleString("ko-KR", { hour12: false }); }

function updateWalletView() {
  $("walletState").textContent = state.walletConnected ? "연결됨" : "미연결";
  $("walletAddress").textContent = state.walletAddress;
  $("balance").textContent = `${format(state.balance)} VIRTUAL`;
}

function connectWalletMock() {
  state.walletConnected = !state.walletConnected;
  state.walletAddress = state.walletConnected ? "0xDA...B1E" : "-";
  appendTx({ type: state.walletConnected ? "WALLET_CONNECT" : "WALLET_DISCONNECT", amount: 0, note: "wallet toggle" });
  updateWalletView();
  persistState();
}

function appendTx(tx) {
  state.txs.unshift({ id: crypto.randomUUID(), at: now(), ...tx });
  state.txs = state.txs.slice(0, 100);
  renderTxHistory();
}

function renderTxHistory() {
  const wrap = $("txHistory");
  if (!state.txs.length) {
    wrap.innerHTML = `<div class="muted">거래 기록이 없습니다.</div>`;
    return;
  }
  wrap.innerHTML = state.txs.map(t => `
    <div data-tx-id="${t.id}">
      <strong>${t.type}</strong> · ${t.at}<br/>
      <span class="muted">${t.note || "-"}</span>
      <div>금액: ${format(t.amount)} VIRTUAL</div>
    </div>
  `).join("");
}

function renderAgents() {
  const query = $("searchInput").value.trim().toLowerCase();
  const list = $("agentList");
  const tpl = $("agentCardTpl");
  list.innerHTML = "";

  const filtered = state.agents.filter(a =>
    `${a.name} ${a.type} ${a.desc}`.toLowerCase().includes(query)
  );

  filtered.forEach(agent => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".card");
    card.setAttribute("data-agent-id", agent.id);
    card.setAttribute("data-agent-type", agent.type);
    card.querySelector(".name").textContent = agent.name;
    card.querySelector(".tag").textContent = agent.type;
    card.querySelector(".desc").textContent = agent.desc;
    card.querySelector(".price").textContent = `가격: ${format(agent.price)} VIRTUAL`;
    card.querySelector(".owners").textContent = `오너: ${format(agent.owners)}`;
    node.querySelector(".viewBtn").addEventListener("click", () => selectAgent(agent.id));
    node.querySelector(".buyBtn").addEventListener("click", () => buyAgent(agent.id));
    list.appendChild(node);
  });

  if (!filtered.length) list.innerHTML = `<div class="muted">검색 결과 없음</div>`;
}

function selectAgent(id) {
  const agent = state.agents.find(a => a.id === id);
  if (!agent) return;
  state.selectedAgentId = id;
  const owned = state.holdings[id] || 0;
  $("agentDetail").innerHTML = `
    <div data-agent-detail="${id}">
      <h3>${agent.name}</h3>
      <p class="muted">${agent.desc}</p>
      <div>카테고리: <strong>${agent.type}</strong></div>
      <div>가격: <strong>${format(agent.price)} VIRTUAL</strong></div>
      <div>오너 수: <strong>${format(agent.owners)}</strong></div>
      <div>평점: <strong>${agent.rating}</strong></div>
      <div>추정 MRR: <strong>${format(agent.mrr)} VIRTUAL</strong></div>
      <div>내 보유 수량: <strong>${owned}</strong></div>
      <br/>
      <button onclick="buyAgent('${agent.id}')">이 상세에서 구매</button>
    </div>
  `;
  persistState();
}

function buyAgent(id) {
  const agent = state.agents.find(a => a.id === id);
  if (!agent) return;
  if (!state.walletConnected) {
    alert("지갑을 먼저 연결해줘.");
    return;
  }
  if (state.balance < agent.price) {
    alert("잔액 부족");
    return;
  }

  state.balance -= agent.price;
  state.holdings[id] = (state.holdings[id] || 0) + 1;
  agent.owners += 1;

  appendTx({ type: "BUY", amount: agent.price, note: `${agent.name} 1개 구매` });
  updateWalletView();
  renderPortfolio();
  renderAgents();
  if (state.selectedAgentId === id) selectAgent(id);
  persistState();
}

function renderPortfolio() {
  const el = $("portfolio");
  const entries = Object.entries(state.holdings);
  if (!entries.length) {
    el.innerHTML = `<div class="muted">아직 구매한 에이전트가 없습니다.</div>`;
    return;
  }

  el.innerHTML = entries.map(([id, count]) => {
    const a = state.agents.find(v => v.id === id);
    return `<div data-holding-id="${id}"><strong>${a?.name || id}</strong><br/><span class="muted">보유: ${count} · 단가: ${format(a?.price || 0)} VIRTUAL</span></div>`;
  }).join("");
}

function bindCalculator() {
  $("calcBtn").addEventListener("click", () => {
    const u = Number($("users").value);
    const a = Number($("arpu").value);
    const c = Number($("costRate").value) / 100;
    const out = $("result");

    if ([u, a, c].some(v => Number.isNaN(v) || v < 0) || c > 1) {
      out.innerHTML = `<span class="error">값을 다시 입력해줘.</span>`;
      return;
    }

    const revenue = u * a;
    const cost = revenue * c;
    const profit = revenue - cost;
    const margin = revenue === 0 ? 0 : (profit / revenue) * 100;

    out.innerHTML = `
      월 매출: <strong>${format(revenue)} VIRTUAL</strong><br/>
      월 비용: <strong>${format(cost)} VIRTUAL</strong><br/>
      월 순이익: <strong>${format(profit)} VIRTUAL</strong><br/>
      이익률: <strong>${margin.toFixed(1)}%</strong>
    `;
  });
}

function bindAdminForm() {
  const form = $("agentForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const type = String(fd.get("type") || "").trim();
    const desc = String(fd.get("desc") || "").trim();
    const price = Number(fd.get("price"));

    if (!name || !type || !desc || !Number.isFinite(price) || price <= 0) {
      $("formMsg").innerHTML = `<span class="error">입력값을 확인해줘.</span>`;
      return;
    }

    const id = `a${Date.now().toString().slice(-6)}`;
    state.agents.unshift({ id, name, type, desc, price, owners: 0, rating: 0, mrr: 0 });
    appendTx({ type: "AGENT_CREATE", amount: 0, note: `${name} 등록` });
    $("formMsg").textContent = `등록 완료: ${name}`;
    form.reset();
    renderAgents();
    persistState();
  });
}

function renderMachineState() {
  const summary = {
    walletConnected: state.walletConnected,
    walletAddress: state.walletAddress,
    balance: state.balance,
    agentCount: state.agents.length,
    holdingCount: Object.values(state.holdings).reduce((a, b) => a + b, 0),
    txCount: state.txs.length,
    selectedAgentId: state.selectedAgentId,
    agents: state.agents.map(a => ({ id: a.id, name: a.name, type: a.type, price: a.price, owners: a.owners }))
  };
  $("stateDump").value = JSON.stringify(summary, null, 2);
}

function init() {
  loadState();
  updateWalletView();
  renderAgents();
  renderPortfolio();
  renderTxHistory();
  bindCalculator();
  bindAdminForm();
  renderMachineState();

  $("connectWalletBtn").addEventListener("click", connectWalletMock);
  $("searchInput").addEventListener("input", renderAgents);
}

window.buyAgent = buyAgent;
window.addEventListener("DOMContentLoaded", init);
