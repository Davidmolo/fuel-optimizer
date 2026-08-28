import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import { getProfileController, resetPasswordController } from "../controllers/profile.controller";
import { getProfileSchema, resetPasswordSchema } from "../validators/profile.validator";

const profileRouter = Router();

profileRouter.get("/", validateRequest(getProfileSchema), getProfileController);
profileRouter.put("/reset-password", validateRequest(resetPasswordSchema), resetPasswordController);

export default profileRouter;
