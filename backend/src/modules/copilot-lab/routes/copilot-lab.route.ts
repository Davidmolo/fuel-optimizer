import { Router } from "express";
import {
  inspectCopilotLabController,
  runCopilotLabActionController,
  setCopilotLabAutomationController,
} from "../controllers/copilot-lab.controller";
import { validateCopilotLabAction, validateCopilotLabAutomation } from "../validators/copilot-lab.validator";

const copilotLabRouter = Router();

copilotLabRouter.get("/", inspectCopilotLabController);
copilotLabRouter.put("/automation", validateCopilotLabAutomation, setCopilotLabAutomationController);
copilotLabRouter.post("/actions", validateCopilotLabAction, runCopilotLabActionController);

export default copilotLabRouter;
