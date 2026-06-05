import { Router, type IRouter } from "express";
import {
  GetBlockchainNetworkQueryParams,
  GetBlockchainNetworkResponse,
  DeployContractBody,
  DeployContractResponse,
} from "@workspace/api-zod";
import { db, activityTable } from "@workspace/db";

const router: IRouter = Router();

const NETWORK_CONFIG: Record<
  string,
  { chain_id: number; base_block: number; base_gas: number; tps: number }
> = {
  ethereum: { chain_id: 1, base_block: 19_800_000, base_gas: 25, tps: 15 },
  sepolia: { chain_id: 11155111, base_block: 5_900_000, base_gas: 8, tps: 12 },
  polygon: { chain_id: 137, base_block: 55_000_000, base_gas: 150, tps: 65 },
  arbitrum: {
    chain_id: 42161,
    base_block: 200_000_000,
    base_gas: 0.1,
    tps: 40,
  },
};

async function logActivity(
  type: string,
  message: string,
  status: "success" | "warning" | "error" | "info"
): Promise<void> {
  try {
    await db.insert(activityTable).values({ type, message, status }).execute();
  } catch {
    // non-fatal
  }
}

router.get("/blockchain/network", async (req, res): Promise<void> => {
  const parsed = GetBlockchainNetworkQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const network = parsed.data.network ?? "ethereum";
  const config = NETWORK_CONFIG[network] ?? NETWORK_CONFIG.ethereum;

  const elapsed = Math.floor(Date.now() / 1000);
  const blockNumber =
    config.base_block + Math.floor(elapsed / 12) + Math.floor(Math.random() * 3);
  const gasVariance = (Math.random() - 0.5) * config.base_gas * 0.3;
  const gasPrice = Math.max(0.01, config.base_gas + gasVariance);
  const pendingTxns = Math.floor(Math.random() * 300) + 50;
  const tpsVariance = (Math.random() - 0.5) * config.tps * 0.2;
  const tps = Math.max(1, config.tps + tpsVariance);

  const response = GetBlockchainNetworkResponse.parse({
    network,
    block_number: blockNumber,
    gas_price_gwei: Number(gasPrice.toFixed(2)),
    chain_id: config.chain_id,
    tps: Number(tps.toFixed(1)),
    pending_transactions: pendingTxns,
  });

  res.json(response);
});

router.post("/blockchain/deploy", async (req, res): Promise<void> => {
  const parsed = DeployContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { contract_name, network = "ethereum" } = parsed.data;

  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

  const contractAddress =
    "0x" +
    Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  const gasUsed = Math.floor(Math.random() * 500_000) + 100_000;
  const config = NETWORK_CONFIG[network] ?? NETWORK_CONFIG.ethereum;
  const elapsed = Math.floor(Date.now() / 1000);
  const blockNumber =
    config.base_block + Math.floor(elapsed / 12);

  const response = DeployContractResponse.parse({
    success: true,
    contract_address: contractAddress,
    transaction_hash: txHash,
    gas_used: gasUsed,
    block_number: blockNumber,
    network,
  });

  await logActivity(
    "deploy",
    `Contract "${contract_name}" deployed to ${network} at ${contractAddress.slice(0, 10)}...`,
    "success"
  );

  res.json(response);
});

export default router;
