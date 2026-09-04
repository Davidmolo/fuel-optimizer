import type { Request, Response } from "express";
import { getRequestUser } from "../../../middlewares/require-authenticated-user";
import { HttpError } from "../../../utils/http-error";
import {
  acceptInvitation,
  deleteAccount,
  getInvitationByToken,
  inviteAccount,
  listWorkspaceAccounts,
  resendInvitation,
  revokeInvitation,
} from "../services/account.service";

function requireActor(req: Request) {
  const actor = getRequestUser(req);

  if (!actor) {
    throw new HttpError("Authentication required", 401);
  }

  return actor;
}

export async function listAccountsController(req: Request, res: Response) {
  const accounts = await listWorkspaceAccounts(requireActor(req));

  return res.status(200).json({
    success: true,
    message: "Accounts fetched successfully",
    data: accounts,
  });
}

export async function inviteAccountController(req: Request, res: Response) {
  const invitation = await inviteAccount(requireActor(req), req.body);

  return res.status(201).json({
    success: true,
    message: `Invitation sent to ${invitation.email}`,
    data: invitation,
  });
}

export async function resendInvitationController(req: Request, res: Response) {
  const invitation = await resendInvitation(requireActor(req), String(req.params.invitationId));

  return res.status(200).json({
    success: true,
    message: `Invitation resent to ${invitation.email}`,
    data: invitation,
  });
}

export async function revokeInvitationController(req: Request, res: Response) {
  const result = await revokeInvitation(requireActor(req), String(req.params.invitationId));

  return res.status(200).json({
    success: true,
    message: "Invitation revoked",
    data: result,
  });
}

export async function deleteAccountController(req: Request, res: Response) {
  const result = await deleteAccount(requireActor(req), String(req.params.accountId));

  return res.status(200).json({
    success: true,
    message: "Account removed",
    data: result,
  });
}

export async function getInvitationController(req: Request, res: Response) {
  const invitation = await getInvitationByToken(String(req.params.token));

  return res.status(200).json({
    success: true,
    message: "Invitation is valid",
    data: invitation,
  });
}

export async function acceptInvitationController(req: Request, res: Response) {
  const accepted = await acceptInvitation({
    token: String(req.params.token),
    password: req.body.password,
  });

  return res.status(200).json({
    success: true,
    message: "Account created. You can now sign in.",
    data: accepted,
  });
}
