import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  forgotPasswordController,
  loginController,
  resendOtpController,
  resetPasswordController,
  verifyOtpController,
} from "../controllers/auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordWithOtpSchema,
  verifyOtpSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/login", validateRequest(loginSchema), loginController);
authRouter.post("/verify-otp", validateRequest(verifyOtpSchema), verifyOtpController);
authRouter.post("/resend-otp", validateRequest(resendOtpSchema), resendOtpController);
authRouter.post("/forgot-password", validateRequest(forgotPasswordSchema), forgotPasswordController);
authRouter.post("/reset-password", validateRequest(resetPasswordWithOtpSchema), resetPasswordController);

export default authRouter;
