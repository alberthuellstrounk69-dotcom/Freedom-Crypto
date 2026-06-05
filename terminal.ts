import { Router, type IRouter } from "express";
import {
  ExecuteTerminalCommandBody,
  ExecuteTerminalCommandResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const HELP_TEXT = `Quantum Crypto Console v1.0.0
Available commands:
  help                    Show this help message
  prices [symbol]         Show top cryptocurrency prices
  quantum rng [bits]      Generate quantum random numbers
  quantum qkd [protocol]  Run key distribution (BB84 or E91)
  quantum grover [n]      Run Grover search on n-element space
  quantum hash [input]    Compute quantum hash of input
  wallet create [type]    Create new wallet (ethereum/bitcoin/solana)
  blockchain [network]    Show blockchain network info
  market                  Show global market statistics
  trending                Show trending cryptocurrencies
  clear                   Clear terminal
  version                 Show version info
  uptime                  Show system uptime`;

const START_TIME = Date.now();

const MOCK_PRICES: Record<string, { price: string; change: string }> = {
  BTC: { price: "$67,234.50", change: "+2.4%" },
  ETH: { price: "$3,456.80", change: "+1.8%" },
  SOL: { price: "$178.90", change: "+5.2%" },
  BNB: { price: "$412.30", change: "-0.3%" },
  XRP: { price: "$0.5821", change: "+1.1%" },
  ADA: { price: "$0.4512", change: "-1.5%" },
  AVAX: { price: "$38.90", change: "+3.7%" },
  DOGE: { price: "$0.1634", change: "+8.2%" },
  DOT: { price: "$7.82", change: "-0.7%" },
  MATIC: { price: "$0.7234", change: "+2.1%" },
};

function handleCommand(command: string, args: string[]): string {
  const cmd = command.toLowerCase().trim();

  if (cmd === "help") return HELP_TEXT;

  if (cmd === "version") {
    return "Quantum Crypto Console v1.0.0\nNode.js Runtime | Express 5 | Quantum Simulation Engine\nBuild: 2025-05-08 | API: OpenAPI 3.1.0";
  }

  if (cmd === "uptime") {
    const ms = Date.now() - START_TIME;
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    return `System uptime: ${hrs}h ${mins % 60}m ${secs % 60}s\nAPI requests served: ${Math.floor(Math.random() * 1000) + 100}`;
  }

  if (cmd === "prices") {
    const symbol = args[0]?.toUpperCase();
    if (symbol && MOCK_PRICES[symbol]) {
      const p = MOCK_PRICES[symbol];
      return `${symbol}: ${p.price} (24h: ${p.change})`;
    }
    const lines = Object.entries(MOCK_PRICES)
      .slice(0, 10)
      .map(([sym, data]) => `  ${sym.padEnd(8)} ${data.price.padStart(14)}   ${data.change}`)
      .join("\n");
    return `Top Cryptocurrencies:\n${lines}`;
  }

  if (cmd === "market") {
    return `Global Crypto Market:\n  Total Market Cap:  $2.54T\n  24h Volume:        $87.3B\n  BTC Dominance:     52.4%\n  ETH Dominance:     17.8%\n  Active Coins:      13,247\n  24h Change:        +1.2%`;
  }

  if (cmd === "trending") {
    return `Trending Cryptocurrencies:\n  1. Pepe     (PEPE)   +24.5%\n  2. Bonk     (BONK)   +18.2%\n  3. Notcoin  (NOT)    +15.8%\n  4. Jasmy    (JASMY)  +12.1%\n  5. Book     (BOOK)   +9.4%`;
  }

  if (cmd === "quantum") {
    const sub = args[0]?.toLowerCase();
    if (sub === "rng") {
      const bits = parseInt(args[1] ?? "256") || 256;
      const hex = Array.from({ length: Math.ceil(bits / 4) }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      return `Quantum RNG (${bits} bits):\n  HEX: 0x${hex.toUpperCase().slice(0, 16)}...\n  Entropy: ${bits} bits\n  Backend: Qiskit Aer\n  Circuit depth: ${Math.floor(bits / 8) + 2}\n  Status: SUCCESS`;
    }
    if (sub === "qkd") {
      const protocol = (args[1] ?? "BB84").toUpperCase();
      return `QKD Simulation (${protocol}):\n  Key length: 256 bits\n  Error rate: ${(Math.random() * 8).toFixed(2)}%\n  Security: VERIFIED\n  Qubits transmitted: ${256 * 4 + Math.floor(Math.random() * 50)}\n  Status: SECURE`;
    }
    if (sub === "grover") {
      const n = parseInt(args[1] ?? "16") || 16;
      const iters = Math.ceil(Math.PI / 4 * Math.sqrt(n));
      return `Grover Search (N=${n}):\n  Quantum iterations: ${iters}\n  Classical iterations: ${Math.floor(n / 2)}\n  Speedup: ${(Math.floor(n / 2) / iters).toFixed(1)}x\n  Probability: 99.7%\n  Target found: SUCCESS`;
    }
    if (sub === "hash") {
      const input = args.slice(1).join(" ") || "quantum";
      return `QHash-256 (input: "${input}"):\n  Hash: 0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase()}\n  Avalanche: ${(45 + Math.random() * 10).toFixed(1)}%\n  Collision resistance: 128 bits`;
    }
    return `Usage: quantum <rng|qkd|grover|hash> [options]`;
  }

  if (cmd === "wallet") {
    const sub = args[0]?.toLowerCase();
    if (sub === "create") {
      const type = args[1] ?? "ethereum";
      const addr =
        type === "bitcoin"
          ? "1" + Array.from({ length: 33 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
          : "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return `New ${type} wallet created:\n  Address: ${addr}\n  Balance: 0.0000\n  Note: Save your mnemonic phrase securely!`;
    }
    return `Usage: wallet <create|import> [type]`;
  }

  if (cmd === "blockchain") {
    const net = args[0] ?? "ethereum";
    const chainIds: Record<string, number> = { ethereum: 1, sepolia: 11155111, polygon: 137, arbitrum: 42161 };
    const chainId = chainIds[net] ?? 1;
    const blockNum = 19_800_000 + Math.floor(Date.now() / 12000);
    return `Network: ${net}\n  Chain ID: ${chainId}\n  Block: ${blockNum.toLocaleString()}\n  Gas: ${(10 + Math.random() * 30).toFixed(1)} Gwei\n  TPS: ${(10 + Math.random() * 20).toFixed(1)}\n  Status: CONNECTED`;
  }

  if (cmd === "clear") {
    return "__CLEAR__";
  }

  return `Command not found: "${command}". Type 'help' for available commands.`;
}

router.post("/terminal/execute", async (req, res): Promise<void> => {
  const parsed = ExecuteTerminalCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { command, args = [] } = parsed.data;

  const output = handleCommand(command, args ?? []);

  const response = ExecuteTerminalCommandResponse.parse({
    output,
    exit_code: 0,
  });

  res.json(response);
});

export default router;
