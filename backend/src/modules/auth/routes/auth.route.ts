import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  acceptInvitationController,
  getInvitationController,
} from "../../account/controllers/account.controller";
import {
  acceptInvitationSchema,
  invitationTokenParamsSchema,
} from "../../account/validators/account.validator";
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
authRouter.get("/invitations/:token", validateRequest(invitationTokenParamsSchema), getInvitationController);
authRouter.post("/invitations/:token/accept", validateRequest(acceptInvitationSchema), acceptInvitationController);

export default authRouter;
