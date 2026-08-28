import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import authRouter from "../modules/auth/routes/auth.route";
import contractRouter from "../modules/contract/routes/contract.route";
import fleetRouter from "../modules/fleet/routes/fleet.route";
import fuelLogRouter from "../modules/fuel-log/routes/fuel-log.route";
import mailConfigRouter from "../modules/mail-config/routes/mail-config.route";
import profileRouter from "../modules/profile/routes/profile.route";
import samsaraConfigRouter from "../modules/samsara-config/routes/samsara-config.route";
import recommendationConfigRouter from "../modules/recommendation-config/routes/recommendation-config.route";
import recommendationRouter from "../modules/recommendation/routes/recommendation.route";
import stationRouter from "../modules/station/routes/station.route";
import trimbleConfigRouter from "../modules/trimble-config/routes/trimble-config.route";
import twilioConfigRouter from "../modules/twilio-config/routes/twilio-config.route";
import tmsRouter from "../modules/tms/routes/tms.route";

const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/auth", authRouter);
apiRouter.use("/contracts", contractRouter);
apiRouter.use("/fleet", fleetRouter);
apiRouter.use("/fuel-logs", fuelLogRouter);
apiRouter.use("/mail-config", mailConfigRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/samsara-config", samsaraConfigRouter);
apiRouter.use("/trimble-config", trimbleConfigRouter);
apiRouter.use("/stations", stationRouter);
apiRouter.use("/recommendation-config", recommendationConfigRouter);
apiRouter.use("/recommendations", recommendationRouter);
apiRouter.use("/twilio-config", twilioConfigRouter);
apiRouter.use("/tms", tmsRouter);

export default apiRouter;
