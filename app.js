const STORE_KEY = "agent_market_demo_v2";
const TARGET_CHAIN_ID = "0x2105"; // Base Mainnet
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_MICRO_PER_VIRTUAL = 50000n; // 0.05 USDC per 1 VIRTUAL
const MAX_TEXT_LEN = 120;

const seedAgents = [
  { id: "a1", name: "SEO Writer Agent", type: "Content", desc: "키워드 리서치 + 블로그 초안 자동 작성", price: 120, owners: 214, rating: 4.6, mrr: 1800 },
  { id: "a2", name: "CS Auto-Reply Agent", type: "Support", desc: "고객문의 분류/응답/티켓 요약 자동화", price: 180, owners: 132, rating: 4.8, mrr: 2300 },
  { id: "a3", name: "Market Research Agent", type: "Analytics", desc: "경쟁사/가격/트렌드 리포트 생성", price: 240, owners: 89, rating: 4.5, mrr: 2700 }
];

const state = {
  walletConnected: false,
  walletAddress: "-",
  walletFullAddress: "",
  merchantAddress: "",
  balance: 1000,
  agents: [...seedAgents],
  holdings: {},
  txs: [],
  selectedAgentId: null
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString();
const now = () => new Date().toLocaleString("ko-KR", { hour12: false });
const shortAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

function sanitizeText(value, maxLen = MAX_TEXT_LEN) {
  return String(value || "")
    .replace(/[<>"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr || "");
}

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

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function addMutedMessage(el, text) {
  const div = document.createElement("div");
  div.className = "muted";
  div.textContent = text;
  el.appendChild(div);
}

function toUint256Hex(v) {
  return v.toString(16).padStart(64, "0");
}

function encodeErc20TransferData(to, amountSmallestUnit) {
  const selector = "a9059cbb"; // transfer(address,uint256)
  const addr = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amt = toUint256Hex(amountSmallestUnit);
  return `0x${selector}${addr}${amt}`;
}

function usdcMicroFromVirtual(priceVirtual) {
  return BigInt(priceVirtual) * USDC_MICRO_PER_VIRTUAL;
}

function updateWalletView() {
  $("walletState").textContent = state.walletConnected ? "연결됨" : "미연결";
  $("walletAddress").textContent = state.walletAddress;
  $("balance").textContent = `${fmt(state.balance)} VIRTUAL`;
  $("paymentMode").textContent = `USDC on Base (1 VIRTUAL = ${(Number(USDC_MICRO_PER_VIRTUAL) / 1_000_000).toFixed(2)} USDC)`;
  $("merchantAddress").value = state.merchantAddress || "";
  $("connectWalletBtn").textContent = state.walletConnected ? "지갑 연결 해제" : "지갑 연결";
}

async function ensureBaseChain() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === TARGET_CHAIN_ID) return current;

  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TARGET_CHAIN_ID }] });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: TARGET_CHAIN_ID,
          chainName: "Base Mainnet",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"]
        }]
      });
    } else {
      throw switchError;
    }
  }

  return window.ethereum.request({ method: "eth_chainId" });
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask(또는 EVM 지갑)가 필요해요.");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts?.[0];
    if (!account) return;

    const chainId = await ensureBaseChain();
    if (chainId !== TARGET_CHAIN_ID) {
      alert("Base Mainnet 연결이 필요합니다.");
      return;
    }

    state.walletConnected = true;
    state.walletFullAddress = account;
    state.walletAddress = shortAddr(account);
    appendTx({ type: "WALLET_CONNECT", amount: 0, note: `connected ${state.walletAddress} (${chainId})` });
    updateWalletView();
    persistState();
  } catch (err) {
    console.error(err);
    alert(`지갑 연결 실패: ${err?.message || "알 수 없는 오류"}`);
  }
}

function disconnectWallet() {
  state.walletConnected = false;
  state.walletAddress = "-";
  state.walletFullAddress = "";
  appendTx({ type: "WALLET_DISCONNECT", amount: 0, note: "manual disconnect" });
  updateWalletView();
  persistState();
}

function saveMerchantAddress() {
  const input = sanitizeText($("merchantAddress").value, 80);
  if (!isValidAddress(input)) {
    alert("정산 지갑 주소 형식이 올바르지 않아요. 0x로 시작하는 42자 주소를 넣어줘.");
    return;
  }
  state.merchantAddress = input;
  appendTx({ type: "MERCHANT_SET", amount: 0, note: `merchant ${shortAddr(input)}` });
  persistState();
  updateWalletView();
}

function appendTx(tx) {
  state.txs.unshift({
    id: crypto.randomUUID(),
    at: now(),
    type: sanitizeText(tx.type, 40),
    amount: Number(tx.amount || 0),
    note: sanitizeText(tx.note, 180)
  });
  state.txs = state.txs.slice(0, 100);
  renderTxHistory();
}

function renderTxHistory() {
  const wrap = $("txHistory");
  clearChildren(wrap);
  if (!state.txs.length) return addMutedMessage(wrap, "거래 기록이 없습니다.");

  state.txs.forEach((t) => {
    const row = document.createElement("div");
    row.dataset.txId = t.id;

    const title = document.createElement("strong");
    title.textContent = `${t.type} · ${t.at}`;

    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = t.note || "-";

    const amount = document.createElement("div");
    amount.textContent = `금액: ${fmt(t.amount)} VIRTUAL`;

    row.append(title, note, amount);
    wrap.appendChild(row);
  });
}

function renderAgents() {
  const query = sanitizeText($("searchInput").value, 80).toLowerCase();
  const list = $("agentList");
  const tpl = $("agentCardTpl");
  clearChildren(list);

  const filtered = state.agents.filter((a) => `${a.name} ${a.type} ${a.desc}`.toLowerCase().includes(query));
  if (!filtered.length) return addMutedMessage(list, "검색 결과 없음");

  filtered.forEach((agent) => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".card");
    card.dataset.agentId = agent.id;
    card.dataset.agentType = agent.type;

    const usdc = Number(usdcMicroFromVirtual(agent.price)) / 1_000_000;

    node.querySelector(".name").textContent = agent.name;
    node.querySelector(".tag").textContent = agent.type;
    node.querySelector(".desc").textContent = agent.desc;
    node.querySelector(".price").textContent = `가격: ${fmt(agent.price)} VIRTUAL (~ ${usdc.toFixed(2)} USDC)`;
    node.querySelector(".owners").textContent = `오너: ${fmt(agent.owners)}`;

    node.querySelector(".viewBtn").addEventListener("click", () => selectAgent(agent.id));
    node.querySelector(".buyBtn").addEventListener("click", () => buyAgent(agent.id));
    list.appendChild(node);
  });
}

function selectAgent(id) {
  const agent = state.agents.find((a) => a.id === id);
  if (!agent) return;
  state.selectedAgentId = id;

  const wrap = $("agentDetail");
  clearChildren(wrap);
  wrap.classList.remove("empty");

  const owned = state.holdings[id] || 0;
  const usdc = Number(usdcMicroFromVirtual(agent.price)) / 1_000_000;
  const lines = [
    ["카테고리", agent.type],
    ["가격", `${fmt(agent.price)} VIRTUAL (~ ${usdc.toFixed(2)} USDC)`],
    ["오너 수", fmt(agent.owners)],
    ["평점", String(agent.rating)],
    ["추정 MRR", `${fmt(agent.mrr)} VIRTUAL`],
    ["내 보유 수량", String(owned)]
  ];

  const h3 = document.createElement("h3");
  h3.textContent = agent.name;
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = agent.desc;

  wrap.append(h3, p);
  lines.forEach(([k, v]) => {
    const d = document.createElement("div");
    d.textContent = `${k}: ${v}`;
    wrap.appendChild(d);
  });

  const btn = document.createElement("button");
  btn.textContent = "USDC로 구매";
  btn.addEventListener("click", () => buyAgent(agent.id));
  wrap.appendChild(document.createElement("br"));
  wrap.appendChild(btn);

  persistState();
}

async function payWithUsdc(fromAddress, toAddress, amountMicro) {
  const data = encodeErc20TransferData(toAddress, amountMicro);
  const txParams = [{
    from: fromAddress,
    to: USDC_BASE_ADDRESS,
    data,
    value: "0x0"
  }];

  return window.ethereum.request({ method: "eth_sendTransaction", params: txParams });
}

async function buyAgent(id) {
  const agent = state.agents.find((a) => a.id === id);
  if (!agent) return;

  if (!state.walletConnected || !state.walletFullAddress) return alert("지갑을 먼저 연결해줘.");
  if (!state.merchantAddress || !isValidAddress(state.merchantAddress)) return alert("먼저 정산 지갑 주소를 저장해줘.");
  if (state.balance < agent.price) return alert("시뮬레이션 잔액 부족");

  try {
    const chainId = await window.ethereum?.request?.({ method: "eth_chainId" });
    if (chainId !== TARGET_CHAIN_ID) return alert("Base Mainnet에서만 구매 가능해요.");
  } catch (_) {
    return alert("지갑 상태를 확인할 수 없어요.");
  }

  const amountMicro = usdcMicroFromVirtual(agent.price);
  const amountUsdc = Number(amountMicro) / 1_000_000;
  const ok = confirm(
    `[USDC 결제 확인]\n에이전트: ${agent.name}\n보내는 토큰: USDC\n금액: ${amountUsdc.toFixed(2)} USDC\n수령 주소: ${state.merchantAddress}\n진행할까?`
  );
  if (!ok) return;

  try {
    const txHash = await payWithUsdc(state.walletFullAddress, state.merchantAddress, amountMicro);

    state.balance -= agent.price;
    state.holdings[id] = (state.holdings[id] || 0) + 1;
    agent.owners += 1;

    appendTx({
      type: "BUY_USDC",
      amount: agent.price,
      note: `${agent.name} 결제 ${amountUsdc.toFixed(2)} USDC / tx ${txHash.slice(0, 10)}...`
    });

    updateWalletView();
    renderPortfolio();
    renderAgents();
    if (state.selectedAgentId === id) selectAgent(id);
    persistState();
  } catch (err) {
    console.error(err);
    alert(`USDC 결제 실패: ${err?.message || "알 수 없는 오류"}`);
    appendTx({ type: "BUY_FAILED", amount: 0, note: sanitizeText(err?.message || "payment failed", 120) });
    persistState();
  }
}

function renderPortfolio() {
  const el = $("portfolio");
  clearChildren(el);

  const entries = Object.entries(state.holdings);
  if (!entries.length) return addMutedMessage(el, "아직 구매한 에이전트가 없습니다.");

  entries.forEach(([id, count]) => {
    const a = state.agents.find((v) => v.id === id);
    const box = document.createElement("div");
    box.dataset.holdingId = id;

    const name = document.createElement("strong");
    name.textContent = a?.name || id;

    const meta = document.createElement("span");
    meta.className = "muted";
    meta.textContent = `보유: ${count} · 단가: ${fmt(a?.price || 0)} VIRTUAL`;

    box.append(name, document.createElement("br"), meta);
    el.appendChild(box);
  });
}

function bindCalculator() {
  $("calcBtn").addEventListener("click", () => {
    const u = Number($("users").value);
    const a = Number($("arpu").value);
    const c = Number($("costRate").value) / 100;

    const out = $("result");
    if ([u, a, c].some((v) => Number.isNaN(v) || v < 0) || c > 1) {
      out.textContent = "값을 다시 입력해줘.";
      out.classList.add("error");
      return;
    }

    out.classList.remove("error");
    const revenue = u * a;
    const cost = revenue * c;
    const profit = revenue - cost;
    const margin = revenue === 0 ? 0 : (profit / revenue) * 100;
    out.textContent = `월 매출 ${fmt(revenue)} / 월 비용 ${fmt(cost)} / 월 순이익 ${fmt(profit)} / 이익률 ${margin.toFixed(1)}%`;
  });
}

function bindAdminForm() {
  const form = $("agentForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = sanitizeText(fd.get("name"), 50);
    const type = sanitizeText(fd.get("type"), 40);
    const desc = sanitizeText(fd.get("desc"), 140);
    const price = Number(fd.get("price"));

    if (!name || !type || !desc || !Number.isFinite(price) || price <= 0) {
      $("formMsg").textContent = "입력값을 확인해줘.";
      $("formMsg").classList.add("error");
      return;
    }

    $("formMsg").classList.remove("error");
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
    chainRequired: TARGET_CHAIN_ID,
    payment: {
      token: "USDC",
      tokenAddress: USDC_BASE_ADDRESS,
      merchantAddress: state.merchantAddress,
      usdcPerVirtual: Number(USDC_MICRO_PER_VIRTUAL) / 1_000_000
    },
    balance: state.balance,
    agentCount: state.agents.length,
    holdingCount: Object.values(state.holdings).reduce((a, b) => a + b, 0),
    txCount: state.txs.length,
    selectedAgentId: state.selectedAgentId,
    agents: state.agents.map((a) => ({ id: a.id, name: a.name, type: a.type, price: a.price, owners: a.owners }))
  };
  $("stateDump").value = JSON.stringify(summary, null, 2);
}

function bindWalletEvents() {
  if (!window.ethereum) return;

  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts || accounts.length === 0) return disconnectWallet();
    state.walletConnected = true;
    state.walletFullAddress = accounts[0];
    state.walletAddress = shortAddr(accounts[0]);
    updateWalletView();
    persistState();
  });

  window.ethereum.on("chainChanged", (chainId) => {
    appendTx({ type: "CHAIN_CHANGED", amount: 0, note: `chain ${chainId}` });
    persistState();
  });
}

function init() {
  loadState();
  updateWalletView();
  renderAgents();
  renderPortfolio();
  renderTxHistory();
  bindCalculator();
  bindAdminForm();
  bindWalletEvents();
  renderMachineState();

  $("connectWalletBtn").addEventListener("click", async () => {
    if (state.walletConnected) return disconnectWallet();
    await connectWallet();
  });

  $("saveMerchantBtn").addEventListener("click", saveMerchantAddress);
  $("searchInput").addEventListener("input", renderAgents);
}

window.addEventListener("DOMContentLoaded", init);
