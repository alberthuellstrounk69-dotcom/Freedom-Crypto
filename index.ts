import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoRouter from "./crypto";
import quantumRouter from "./quantum";
import blockchainRouter from "./blockchain";
import walletRouter from "./wallet";
import terminalRouter from "./terminal";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoRouter);
router.use(quantumRouter);
router.use(blockchainRouter);
router.use(walletRouter);
router.use(terminalRouter);
router.use(statsRouter);

export default router;
