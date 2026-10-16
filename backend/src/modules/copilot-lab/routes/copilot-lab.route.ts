import { Router } from "express";
import { inspectCopilotLabController, runCopilotLabActionController } from "../controllers/copilot-lab.controller";
import { validateCopilotLabAction } from "../validators/copilot-lab.validator";

const copilotLabRouter = Router();

copilotLabRouter.get("/", inspectCopilotLabController);
copilotLabRouter.post("/actions", validateCopilotLabAction, runCopilotLabActionController);

export default copilotLabRouter;
