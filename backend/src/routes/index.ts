import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import { requireAdmin } from "../middlewares/require-admin";
import accountRouter from "../modules/account/routes/account.route";
import authRouter from "../modules/auth/routes/auth.route";
import contractRouter from "../modules/contract/routes/contract.route";
import fleetRouter from "../modules/fleet/routes/fleet.route";
import fuelLogRouter from "../modules/fuel-log/routes/fuel-log.route";
import jobsRouter from "../modules/jobs/routes/jobs.route";
import mailConfigRouter from "../modules/mail-config/routes/mail-config.route";
import profileRouter from "../modules/profile/routes/profile.route";
import recommendationConfigRouter from "../modules/recommendation-config/routes/recommendation-config.route";
import recommendationRouter from "../modules/recommendation/routes/recommendation.route";
import reportsRouter from "../modules/reports/routes/reports.route";
import stationRouter from "../modules/station/routes/station.route";
import twilioConfigRouter from "../modules/twilio-config/routes/twilio-config.route";
import copilotLabRouter from "../modules/copilot-lab/routes/copilot-lab.route";
import tmsRouter from "../modules/tms/routes/tms.route";

const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/accounts", requireAdmin, accountRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/contracts", requireAdmin, contractRouter);
apiRouter.use("/fleet", fleetRouter);
apiRouter.use("/fuel-logs", fuelLogRouter);
apiRouter.use("/jobs", requireAdmin, jobsRouter);
apiRouter.use("/mail-config", requireAdmin, mailConfigRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/stations", stationRouter);
apiRouter.use("/recommendation-config", requireAdmin, recommendationConfigRouter);
apiRouter.use("/recommendations", recommendationRouter);
apiRouter.use("/twilio-config", requireAdmin, twilioConfigRouter);
apiRouter.use("/tms", tmsRouter);
apiRouter.use("/copilot-lab", requireAdmin, copilotLabRouter);

export default apiRouter;
