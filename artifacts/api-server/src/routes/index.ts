import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import workersRouter from "./workers";
import machinesRouter from "./machines";
import tasksRouter from "./tasks";
import hazardsRouter from "./hazards";
import alertsRouter from "./alerts";
import deliveriesRouter from "./deliveries";
import camerasRouter from "./cameras";
import robotsRouter from "./robots";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import statsRouter from "./stats";
import routesRouter from "./routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(workersRouter);
router.use(machinesRouter);
router.use(tasksRouter);
router.use(hazardsRouter);
router.use(alertsRouter);
router.use(deliveriesRouter);
router.use(camerasRouter);
router.use(robotsRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(statsRouter);
router.use(routesRouter);

export default router;
