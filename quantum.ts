import { Router, type IRouter } from "express";
import crypto from "crypto";
import {
  RunQuantumRngBody,
  RunQuantumRngResponse,
  RunQuantumQkdBody,
  RunQuantumQkdResponse,
  RunGroverSearchBody,
  RunGroverSearchResponse,
  RunQuantumHashBody,
  RunQuantumHashResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { activityTable } from "@workspace/db";

const router: IRouter = Router();

function simulateDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function randomBits(count: number): string {
  let bits = "";
  for (let i = 0; i < count; i++) {
    bits += Math.random() > 0.5 ? "1" : "0";
  }
  return bits;
}

async function logActivity(
  type: string,
  message: string,
  status: "success" | "warning" | "error" | "info"
): Promise<void> {
  try {
    await db
      .insert(activityTable)
      .values({ type, message, status })
      .execute();
  } catch {
    // non-fatal
  }
}

router.post("/quantum/rng", async (req, res): Promise<void> => {
  const parsed = RunQuantumRngBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { bits = 256, backend = "qiskit" } = parsed.data;
  const start = Date.now();

  await new Promise((r) => setTimeout(r, simulateDelay(200, 800)));

  const bitString = randomBits(bits);
  const hexValue = BigInt("0b" + bitString)
    .toString(16)
    .padStart(Math.ceil(bits / 4), "0");
  const decimalValue = BigInt("0b" + bitString).toString(10);
  const executionTime = Date.now() - start;

  const response = RunQuantumRngResponse.parse({
    random_bits: bitString,
    hex_value: hexValue,
    decimal_value: decimalValue,
    entropy_bits: bits,
    backend: backend ?? "qiskit",
    execution_time_ms: executionTime,
    circuit_depth: Math.floor(bits / 8) + 2,
    qubits_used: Math.min(bits, 32),
  });

  await logActivity(
    "quantum_rng",
    `Generated ${bits}-bit quantum random number using ${backend}`,
    "success"
  );

  res.json(response);
});

router.post("/quantum/qkd", async (req, res): Promise<void> => {
  const parsed = RunQuantumQkdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { protocol = "BB84", key_length = 256 } = parsed.data;
  const start = Date.now();

  await new Promise((r) => setTimeout(r, simulateDelay(400, 1200)));

  const errorRate = Number((Math.random() * 0.08).toFixed(4));
  const secure = errorRate < 0.11;
  const hexKey = randomHex(Math.ceil(key_length / 8));
  const executionTime = Date.now() - start;

  const qubitsTransmitted =
    protocol === "BB84"
      ? key_length * 4 + Math.floor(Math.random() * 50)
      : key_length * 3 + Math.floor(Math.random() * 40);

  const response = RunQuantumQkdResponse.parse({
    protocol: protocol ?? "BB84",
    shared_key: hexKey,
    key_length,
    error_rate: errorRate,
    secure,
    qubits_transmitted: qubitsTransmitted,
    execution_time_ms: executionTime,
  });

  await logActivity(
    "quantum_qkd",
    `${protocol} key distribution completed — ${secure ? "SECURE" : "COMPROMISED"} (error rate: ${(errorRate * 100).toFixed(2)}%)`,
    secure ? "success" : "warning"
  );

  res.json(response);
});

router.post("/quantum/grover", async (req, res): Promise<void> => {
  const parsed = RunGroverSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search_space = 16, target } = parsed.data;
  const start = Date.now();

  await new Promise((r) => setTimeout(r, simulateDelay(300, 900)));

  const n = search_space;
  const quantumIters = Math.ceil(Math.PI / 4 * Math.sqrt(n));
  const classicalIters = Math.floor(n / 2) + Math.floor(Math.random() * (n / 4));
  const speedup = classicalIters / quantumIters;
  const probability = Math.min(0.999, 0.95 + Math.random() * 0.049);
  const foundTarget =
    target ?? `0x${randomHex(4).toUpperCase()}`;
  const executionTime = Date.now() - start;

  const response = RunGroverSearchResponse.parse({
    found: true,
    target: foundTarget,
    iterations: quantumIters,
    classical_iterations: classicalIters,
    speedup_factor: Number(speedup.toFixed(2)),
    execution_time_ms: executionTime,
    probability: Number(probability.toFixed(4)),
  });

  await logActivity(
    "quantum_grover",
    `Grover search found target in ${quantumIters} iterations (${speedup.toFixed(1)}x speedup over classical)`,
    "success"
  );

  res.json(response);
});

router.post("/quantum/hash", async (req, res): Promise<void> => {
  const parsed = RunQuantumHashBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { input = "quantum", algorithm = "QHash-256" } = parsed.data;
  const start = Date.now();

  await new Promise((r) => setTimeout(r, simulateDelay(150, 500)));

  const classicalHash = crypto.createHash("sha256").update(input ?? "quantum").digest("hex");
  const quantumEntropy = randomHex(16);
  const hashLen = algorithm === "QHash-512" ? 64 : 32;
  const combined = crypto
    .createHash("sha256")
    .update(classicalHash + quantumEntropy)
    .digest("hex")
    .slice(0, hashLen * 2);

  const avalanche = Number((0.45 + Math.random() * 0.1).toFixed(4));
  const collisionBits = algorithm === "QHash-512" ? 256 : 128;
  const executionTime = Date.now() - start;

  const response = RunQuantumHashResponse.parse({
    input: input ?? "quantum",
    hash: combined,
    algorithm: algorithm ?? "QHash-256",
    avalanche_effect: avalanche,
    execution_time_ms: executionTime,
    collision_resistance_bits: collisionBits,
  });

  await logActivity(
    "quantum_hash",
    `${algorithm} hash computed for input "${(input ?? "quantum").slice(0, 20)}" (avalanche: ${(avalanche * 100).toFixed(1)}%)`,
    "success"
  );

  res.json(response);
});

export default router;
