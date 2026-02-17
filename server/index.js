import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8788);
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const USDC_BASE_ADDRESS = (process.env.USDC_BASE_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").toLowerCase();
const MERCHANT_ADDRESS = (process.env.MERCHANT_ADDRESS || "").toLowerCase();
const USDC_MICRO_PER_VIRTUAL = BigInt(process.env.USDC_MICRO_PER_VIRTUAL || "50000");
const ORDER_TTL_SECONDS = Number(process.env.ORDER_TTL_SECONDS || 900);

const dbPath = path.join(__dirname, "data", "db.json");

const agents = [
  { id: "a1", name: "SEO Writer Agent", price: 120 },
  { id: "a2", name: "CS Auto-Reply Agent", price: 180 },
  { id: "a3", name: "Market Research Agent", price: 240 }
];

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

function isAddress(addr = "") {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { orders: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function rpc(method, params = []) {
  return fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  }).then((r) => r.json());
}

function parseTransferInput(data = "") {
  if (!data || typeof data !== "string") return null;
  if (!data.startsWith("0xa9059cbb")) return null;
  const hex = data.slice(10);
  if (hex.length < 128) return null;
  const toHex = hex.slice(0, 64);
  const amtHex = hex.slice(64, 128);
  const to = `0x${toHex.slice(24)}`.toLowerCase();
  const amount = BigInt(`0x${amtHex}`);
  return { to, amount };
}

function usdcMicroFromVirtual(vPrice) {
  return BigInt(vPrice) * USDC_MICRO_PER_VIRTUAL;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: nowIso(), chain: "base", usdc: USDC_BASE_ADDRESS });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    chainId: "0x2105",
    usdc: USDC_BASE_ADDRESS,
    merchantAddress: MERCHANT_ADDRESS,
    usdcPerVirtual: Number(USDC_MICRO_PER_VIRTUAL) / 1_000_000
  });
});

app.post("/api/orders", (req, res) => {
  const { agentId, buyerAddress } = req.body || {};
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return res.status(400).json({ ok: false, error: "invalid_agent" });
  if (!isAddress(buyerAddress)) return res.status(400).json({ ok: false, error: "invalid_buyer_address" });
  if (!isAddress(MERCHANT_ADDRESS)) return res.status(500).json({ ok: false, error: "merchant_not_configured" });

  const amountMicro = usdcMicroFromVirtual(agent.price);
  const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ORDER_TTL_SECONDS * 1000);

  const db = loadDB();
  db.orders.unshift({
    id,
    agentId,
    buyerAddress: buyerAddress.toLowerCase(),
    merchantAddress: MERCHANT_ADDRESS,
    usdcAmountMicro: amountMicro.toString(),
    status: "pending",
    txHash: null,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null
  });
  saveDB(db);

  res.json({
    ok: true,
    orderId: id,
    agentId,
    buyerAddress,
    merchantAddress: MERCHANT_ADDRESS,
    usdcAmountMicro: amountMicro.toString(),
    usdcAmount: Number(amountMicro) / 1_000_000,
    expiresAt: expiresAt.toISOString()
  });
});

app.post("/api/orders/:orderId/confirm", async (req, res) => {
  const { orderId } = req.params;
  const { txHash } = req.body || {};
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || "")) return res.status(400).json({ ok: false, error: "invalid_tx_hash" });

  const db = loadDB();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: "order_not_found" });
  if (order.status === "confirmed") return res.json({ ok: true, alreadyConfirmed: true, order });
  if (new Date(order.expiresAt).getTime() < Date.now()) return res.status(400).json({ ok: false, error: "order_expired" });

  const [txResp, rcResp] = await Promise.all([
    rpc("eth_getTransactionByHash", [txHash]),
    rpc("eth_getTransactionReceipt", [txHash])
  ]);

  const tx = txResp?.result;
  const receipt = rcResp?.result;
  if (!tx || !receipt) return res.status(400).json({ ok: false, error: "tx_not_found_or_pending" });
  if (String(receipt.status).toLowerCase() !== "0x1") return res.status(400).json({ ok: false, error: "tx_failed" });

  const from = String(tx.from || "").toLowerCase();
  const toContract = String(tx.to || "").toLowerCase();
  if (from !== order.buyerAddress) return res.status(400).json({ ok: false, error: "tx_from_mismatch" });
  if (toContract !== USDC_BASE_ADDRESS) return res.status(400).json({ ok: false, error: "tx_to_not_usdc_contract" });

  const parsed = parseTransferInput(tx.input);
  if (!parsed) return res.status(400).json({ ok: false, error: "not_erc20_transfer" });
  if (parsed.to !== order.merchantAddress) return res.status(400).json({ ok: false, error: "merchant_mismatch" });
  if (parsed.amount.toString() !== order.usdcAmountMicro) return res.status(400).json({ ok: false, error: "amount_mismatch" });

  order.status = "confirmed";
  order.txHash = txHash;
  order.confirmedAt = nowIso();
  saveDB(db);

  res.json({ ok: true, order });
});

app.get("/api/orders", (_req, res) => {
  const db = loadDB();
  res.json({ ok: true, orders: db.orders.slice(0, 100) });
});

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
});
