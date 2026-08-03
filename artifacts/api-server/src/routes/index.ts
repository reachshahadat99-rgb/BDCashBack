import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import groupBuyRouter from "./group-buy";
import merchantRouter from "./merchant";
import couponsRouter from "./coupons";
import promoDealsRouter from "./promo-deals";
import giftCardsRouter from "./gift-cards";
import adminRouter from "./admin";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(groupBuyRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(walletRouter);
router.use(merchantRouter);
router.use(couponsRouter);
router.use(promoDealsRouter);
router.use(giftCardsRouter);
router.use(adminRouter);

export default router;
