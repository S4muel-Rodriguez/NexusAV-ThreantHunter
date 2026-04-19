import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nexusavRouter from "./nexusav";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nexusavRouter);

export default router;
