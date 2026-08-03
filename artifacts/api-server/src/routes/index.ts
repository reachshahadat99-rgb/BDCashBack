import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import merchantRouter from "./merchant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(merchantRouter);

export default router;
