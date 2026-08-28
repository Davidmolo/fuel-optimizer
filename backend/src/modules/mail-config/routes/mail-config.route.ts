import { Router } from "express";
import { getMailConfigController, verifyMailConfigController } from "../controllers/mail-config.controller";

const mailConfigRouter = Router();

mailConfigRouter.get("/", getMailConfigController);
mailConfigRouter.post("/verify", verifyMailConfigController);

export default mailConfigRouter;
