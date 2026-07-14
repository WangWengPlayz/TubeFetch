import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uptimeRouter from "./uptime";
import downloadRouter from "./download";
import downloadV2Router from "./download-v2";
import downloadV3Router from "./download-v3";
import statsRouter from "./stats";
import homeRouter from "./home";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uptimeRouter);
router.use(downloadRouter);
router.use(downloadV2Router);
router.use(downloadV3Router);
router.use(statsRouter);
router.use(proxyRouter);
// Home page also accessible at /api/ for Replit proxy
router.use("/", homeRouter);

export default router;
