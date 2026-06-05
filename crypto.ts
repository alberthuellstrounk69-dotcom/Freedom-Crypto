import { Router, type IRouter } from "express";
import {
  GetCryptoPricesQueryParams,
  GetCryptoPricesResponse,
  GetCryptoMarketResponse,
  GetTrendingCryptosResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

async function fetchCoinGecko(path: string): Promise<unknown> {
  const res = await fetch(`${COINGECKO_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QuantumCryptoConsole/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

router.get("/crypto/prices", async (req, res): Promise<void> => {
  const parsed = GetCryptoPricesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page, per_page, search } = parsed.data;

  try {
    let url = `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${per_page}&page=${page}&sparkline=false&price_change_percentage=24h`;
    if (search) {
      const searchRes = (await fetchCoinGecko(
        `/search?query=${encodeURIComponent(search)}`
      )) as { coins: Array<{ id: string }> };
      const ids = searchRes.coins
        .slice(0, per_page)
        .map((c: { id: string }) => c.id)
        .join(",");
      if (ids) {
        url = `/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=${per_page}&page=1&sparkline=false`;
      }
    }

    const data = (await fetchCoinGecko(url)) as Array<Record<string, unknown>>;

    const coins = data.map((coin) => ({
      id: String(coin.id ?? ""),
      symbol: String(coin.symbol ?? "").toUpperCase(),
      name: String(coin.name ?? ""),
      image: String(coin.image ?? ""),
      current_price: Number(coin.current_price ?? 0),
      market_cap: Number(coin.market_cap ?? 0),
      market_cap_rank: Number(coin.market_cap_rank ?? 0),
      price_change_percentage_24h: Number(
        coin.price_change_percentage_24h ?? 0
      ),
      total_volume: Number(coin.total_volume ?? 0),
      high_24h: Number(coin.high_24h ?? 0),
      low_24h: Number(coin.low_24h ?? 0),
      circulating_supply: Number(coin.circulating_supply ?? 0),
    }));

    const response = GetCryptoPricesResponse.parse({
      coins,
      total: search ? coins.length : 10000,
      page,
      per_page,
    });

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch crypto prices");
    res.status(502).json({ error: "Failed to fetch crypto prices" });
  }
});

router.get("/crypto/market", async (req, res): Promise<void> => {
  try {
    const data = (await fetchCoinGecko("/global")) as {
      data: Record<string, unknown>;
    };
    const d = data.data;

    const marketCaps = (d.total_market_cap as Record<string, number>) ?? {};
    const volumes = (d.total_volume as Record<string, number>) ?? {};
    const dominance =
      (d.market_cap_percentage as Record<string, number>) ?? {};

    const response = GetCryptoMarketResponse.parse({
      total_market_cap_usd: marketCaps.usd ?? 0,
      total_volume_usd: volumes.usd ?? 0,
      btc_dominance: dominance.btc ?? 0,
      eth_dominance: dominance.eth ?? 0,
      market_cap_change_percentage_24h: Number(
        d.market_cap_change_percentage_24h_usd ?? 0
      ),
      active_cryptocurrencies: Number(d.active_cryptocurrencies ?? 0),
    });

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch crypto market");
    res.status(502).json({ error: "Failed to fetch market data" });
  }
});

router.get("/crypto/trending", async (req, res): Promise<void> => {
  try {
    const data = (await fetchCoinGecko("/search/trending")) as {
      coins: Array<{
        item: {
          id: string;
          name: string;
          symbol: string;
          price_btc: number;
          score: number;
        };
      }>;
    };

    const coins = (data.coins ?? []).map((c, idx) => ({
      id: String(c.item.id ?? ""),
      name: String(c.item.name ?? ""),
      symbol: String(c.item.symbol ?? "").toUpperCase(),
      price_btc: Number(c.item.price_btc ?? 0),
      score: Number(c.item.score ?? idx),
    }));

    const response = GetTrendingCryptosResponse.parse({ coins });
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending cryptos");
    res.status(502).json({ error: "Failed to fetch trending data" });
  }
});

export default router;
