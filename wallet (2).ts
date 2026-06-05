import { Router, type IRouter } from "express";
import crypto from "crypto";
import {
  CreateWalletBody,
  CreateWalletResponse,
  ImportWalletBody,
  ImportWalletResponse,
} from "@workspace/api-zod";
import { db, activityTable } from "@workspace/db";

const router: IRouter = Router();

const WORDLIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
  "advice", "aerobic", "afford", "afraid", "again", "agent", "agree", "ahead",
  "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already",
  "also", "alter", "always", "amateur", "amazing", "among", "amount", "amused",
  "analyst", "anchor", "ancient", "anger", "angle", "angry", "animal", "ankle",
  "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any",
  "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
  "area", "arena", "argue", "arm", "armed", "armor", "army", "around",
  "arrange", "arrest", "arrive", "arrow", "art", "artefact", "artist", "artwork",
  "ask", "aspect", "assault", "asset", "assist", "assume", "asthma", "athlete",
  "atom", "attack", "attend", "attitude", "attract", "auction", "audit", "august",
  "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake",
  "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "balance",
];

function generateMnemonic(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = Math.floor(Math.random() * WORDLIST.length);
    words.push(WORDLIST[idx]);
  }
  return words.join(" ");
}

function mnemonicToPrivateKey(mnemonic: string): string {
  return crypto.createHash("sha256").update(mnemonic).digest("hex");
}

function privateKeyToEthAddress(privateKey: string): string {
  const hash = crypto.createHash("sha256").update(privateKey).digest("hex");
  return "0x" + hash.slice(0, 40);
}

function privateKeyToBtcAddress(privateKey: string): string {
  const hash = crypto
    .createHash("ripemd160")
    .update(Buffer.from(privateKey, "hex"))
    .digest("hex");
  return "1" + hash.slice(0, 33);
}

function privateKeyToSolAddress(privateKey: string): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  const bytes = Buffer.from(privateKey.slice(0, 32), "hex");
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result.slice(0, 44);
}

function deriveAddress(privateKey: string, type: string): string {
  switch (type) {
    case "bitcoin":
      return privateKeyToBtcAddress(privateKey);
    case "solana":
      return privateKeyToSolAddress(privateKey);
    default:
      return privateKeyToEthAddress(privateKey);
  }
}

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

router.post("/wallet/create", async (req, res): Promise<void> => {
  const parsed = CreateWalletBody.safeParse(req.body ?? {});
  const walletType = parsed.success ? (parsed.data.type ?? "ethereum") : "ethereum";

  const mnemonic = generateMnemonic();
  const privateKey = mnemonicToPrivateKey(mnemonic);
  const address = deriveAddress(privateKey, walletType);
  const balance = 0;

  const response = CreateWalletResponse.parse({
    address,
    mnemonic,
    private_key: privateKey,
    type: walletType,
    balance,
  });

  await logActivity(
    "wallet_create",
    `New ${walletType} wallet created: ${address.slice(0, 12)}...`,
    "success"
  );

  res.json(response);
});

router.post("/wallet/import", async (req, res): Promise<void> => {
  const parsed = ImportWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { mnemonic, type = "ethereum" } = parsed.data;

  const privateKey = mnemonicToPrivateKey(mnemonic);
  const address = deriveAddress(privateKey, type ?? "ethereum");

  const response = ImportWalletResponse.parse({
    address,
    type: type ?? "ethereum",
    balance: 0,
  });

  await logActivity(
    "wallet_import",
    `${type} wallet imported: ${address.slice(0, 12)}...`,
    "success"
  );

  res.json(response);
});

export default router;
