import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import groupBuyRouter from "./group-buy";
import merchantRouter from "./merchant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(groupBuyRouter);
router.use(merchantRouter);

export default router;
