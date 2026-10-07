import { Router } from "express";
import { requireSignedInUser } from "../../../middlewares/require-authenticated-user";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  deleteAccountController,
  inviteAccountController,
  listAccountsController,
  assignDispatcherController,
  resendInvitationController,
  revokeInvitationController,
} from "../controllers/account.controller";
import {
  deleteAccountSchema,
  invitationIdParamsSchema,
  inviteAccountSchema,
  assignDispatcherSchema,
  listAccountsSchema,
} from "../validators/account.validator";

const accountRouter = Router();

accountRouter.use(requireSignedInUser);

accountRouter.get("/", validateRequest(listAccountsSchema), listAccountsController);
accountRouter.post("/invitations", validateRequest(inviteAccountSchema), inviteAccountController);
accountRouter.post(
  "/invitations/:invitationId/resend",
  validateRequest(invitationIdParamsSchema),
  resendInvitationController,
);
accountRouter.delete(
  "/invitations/:invitationId",
  validateRequest(invitationIdParamsSchema),
  revokeInvitationController,
);
accountRouter.patch(
  "/:accountId/dispatcher",
  validateRequest(assignDispatcherSchema),
  assignDispatcherController,
);
accountRouter.delete("/:accountId", validateRequest(deleteAccountSchema), deleteAccountController);

export default accountRouter;
