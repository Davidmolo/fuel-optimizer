import { hash } from "bcryptjs";
import { Types } from "mongoose";
import { HttpError } from "../../../utils/http-error";
import { RoleModel } from "../../role/models/role.model";
import { UserModel } from "../../user/models/user.model";
import { ADMIN_ROLE_NAME, isAccountRole, isAdminRole, type AccountRole } from "../../role/constants";
import { InvitationModel } from "../models/invitation.model";
import { canInviteAsRole, canRevokeInvitation, describeDeleteBlock } from "../account-policy";
import { createInvitationToken, hashInvitationToken } from "../invitation-token";
import { sendInvitationEmail, type InvitationEmailPayload } from "./invitation-email.service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AccountActor = {
  id: string;
  email: string;
  roleId: string;
  role: string;
};

export type InvitationDelivery = (payload: InvitationEmailPayload) => Promise<void>;

function toId(value: Types.ObjectId | string) {
  return String(value);
}

function isPendingInvitation(invitation: { acceptedAt?: Date | null; revokedAt?: Date | null; expiresAt: Date }) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt.getTime() > Date.now();
}

async function getRoleByName(name: AccountRole) {
  const role = await RoleModel.findOne({ name }).lean();

  if (!role) {
    throw new HttpError(`Role "${name}" is not configured`, 500);
  }

  return role;
}

async function countAdmins() {
  const adminRole = await RoleModel.findOne({ name: ADMIN_ROLE_NAME }).lean();

  if (!adminRole) {
    return 0;
  }

  return UserModel.countDocuments({ roleId: adminRole._id });
}

async function mapUserRole(roleId: Types.ObjectId | string) {
  const role = await RoleModel.findById(roleId).lean();
  return role?.name ?? "user";
}

export async function listWorkspaceAccounts(actor: AccountActor) {
  const [users, invitations, adminCount] = await Promise.all([
    UserModel.find().sort({ createdAt: 1 }).lean(),
    InvitationModel.find({ acceptedAt: null, revokedAt: null }).sort({ createdAt: -1 }).lean(),
    countAdmins(),
  ]);

  const roleIds = [...new Set(users.map((user) => toId(user.roleId)))];
  const roles = await RoleModel.find({ _id: { $in: roleIds } }).lean();
  const roleById = new Map(roles.map((role) => [toId(role._id), role.name]));

  const inviterIds = [...new Set(invitations.map((invitation) => toId(invitation.invitedBy)))];
  const inviters = inviterIds.length
    ? await UserModel.find({ _id: { $in: inviterIds } }).select({ email: 1 }).lean()
    : [];
  const inviterById = new Map(inviters.map((user) => [toId(user._id), user.email]));

  const members = users.map((user) => {
    const role = roleById.get(toId(user.roleId)) ?? "user";
    const deleteBlockedReason = describeDeleteBlock({
      actor,
      target: { id: toId(user._id), role },
      adminCount,
    });

    return {
      id: toId(user._id),
      email: user.email,
      role,
      createdAt: user.createdAt,
      isCurrentUser: toId(user._id) === actor.id,
      canDelete: deleteBlockedReason === null,
      deleteBlockedReason,
    };
  });

  members.sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "admin" ? -1 : 1;
    }

    return left.email.localeCompare(right.email);
  });

  return {
    currentUser: {
      id: actor.id,
      email: actor.email,
      role: actor.role,
      canInviteAdmin: isAdminRole(actor.role),
    },
    members,
    invitations: invitations.map((invitation) => ({
      id: toId(invitation._id),
      email: invitation.email,
      role: invitation.role,
      invitedByEmail: inviterById.get(toId(invitation.invitedBy)) ?? null,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      expired: invitation.expiresAt.getTime() <= Date.now(),
      canRevoke: canRevokeInvitation({ actor, invitedById: toId(invitation.invitedBy) }),
      canResend: canRevokeInvitation({ actor, invitedById: toId(invitation.invitedBy) }),
    })),
  };
}

async function deliverInvitation(
  payload: InvitationEmailPayload,
  deliver: InvitationDelivery,
) {
  await deliver(payload);
}

export async function inviteAccount(
  actor: AccountActor,
  payload: { email: string; role: string },
  deliver: InvitationDelivery = sendInvitationEmail,
) {
  const email = payload.email.trim().toLowerCase();
  const role = payload.role.trim().toLowerCase();

  if (!isAccountRole(role)) {
    throw new HttpError("Role must be admin or user", 400);
  }

  if (!canInviteAsRole(actor.role, role)) {
    throw new HttpError("Users can only invite other users", 403);
  }

  const existingUser = await UserModel.findOne({ email }).lean();

  if (existingUser) {
    throw new HttpError("An account with this email already exists", 409);
  }

  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const existingInvite = await InvitationModel.findOne({
    email,
    acceptedAt: null,
    revokedAt: null,
  });

  if (existingInvite) {
    existingInvite.role = role;
    existingInvite.tokenHash = tokenHash;
    existingInvite.invitedBy = new Types.ObjectId(actor.id);
    existingInvite.expiresAt = expiresAt;
    await existingInvite.save();
  } else {
    await InvitationModel.create({
      email,
      role,
      tokenHash,
      invitedBy: new Types.ObjectId(actor.id),
      expiresAt,
    });
  }

  await deliverInvitation(
    {
      email,
      token,
      role,
      invitedByEmail: actor.email,
    },
    deliver,
  );

  return {
    email,
    role,
    expiresAt,
  };
}

async function getManagedInvitation(invitationId: string, actor: AccountActor) {
  if (!Types.ObjectId.isValid(invitationId)) {
    throw new HttpError("Invitation not found", 404);
  }

  const invitation = await InvitationModel.findById(invitationId);

  if (!invitation || invitation.acceptedAt || invitation.revokedAt) {
    throw new HttpError("Invitation not found", 404);
  }

  if (!canRevokeInvitation({ actor, invitedById: toId(invitation.invitedBy) })) {
    throw new HttpError("You can only manage invitations you sent", 403);
  }

  return invitation;
}

export async function resendInvitation(
  actor: AccountActor,
  invitationId: string,
  deliver: InvitationDelivery = sendInvitationEmail,
) {
  const invitation = await getManagedInvitation(invitationId, actor);
  const token = createInvitationToken();

  invitation.tokenHash = hashInvitationToken(token);
  invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invitation.save();

  await deliverInvitation(
    {
      email: invitation.email,
      token,
      role: invitation.role,
      invitedByEmail: actor.email,
    },
    deliver,
  );

  return {
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function revokeInvitation(actor: AccountActor, invitationId: string) {
  const invitation = await getManagedInvitation(invitationId, actor);
  invitation.revokedAt = new Date();
  await invitation.save();

  return { id: toId(invitation._id) };
}

export async function deleteAccount(actor: AccountActor, accountId: string) {
  if (!Types.ObjectId.isValid(accountId)) {
    throw new HttpError("Account not found", 404);
  }

  const user = await UserModel.findById(accountId);

  if (!user) {
    throw new HttpError("Account not found", 404);
  }

  const role = await mapUserRole(user.roleId);
  const adminCount = await countAdmins();
  const blockedReason = describeDeleteBlock({
    actor,
    target: { id: toId(user._id), role },
    adminCount,
  });

  if (blockedReason) {
    throw new HttpError(blockedReason, 403);
  }

  await user.deleteOne();
  await InvitationModel.updateMany(
    { email: user.email, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  return { id: toId(user._id), email: user.email };
}

export async function getInvitationByToken(token: string) {
  const tokenHash = hashInvitationToken(token);
  const invitation = await InvitationModel.findOne({ tokenHash }).lean();

  if (!invitation || invitation.revokedAt) {
    throw new HttpError("This invitation is invalid or has been revoked", 404);
  }

  if (invitation.acceptedAt) {
    throw new HttpError("This invitation has already been accepted", 409);
  }

  if (!isPendingInvitation(invitation)) {
    throw new HttpError("This invitation has expired", 410);
  }

  const inviter = await UserModel.findById(invitation.invitedBy).select({ email: 1 }).lean();

  return {
    email: invitation.email,
    role: invitation.role,
    invitedByEmail: inviter?.email ?? null,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(payload: { token: string; password: string }) {
  const tokenHash = hashInvitationToken(payload.token);
  const invitation = await InvitationModel.findOne({ tokenHash });

  if (!invitation || invitation.revokedAt) {
    throw new HttpError("This invitation is invalid or has been revoked", 404);
  }

  if (invitation.acceptedAt) {
    throw new HttpError("This invitation has already been accepted", 409);
  }

  if (!isPendingInvitation(invitation)) {
    throw new HttpError("This invitation has expired", 410);
  }

  const existingUser = await UserModel.findOne({ email: invitation.email }).lean();

  if (existingUser) {
    throw new HttpError("An account with this email already exists", 409);
  }

  const role = await getRoleByName(invitation.role);
  const hashedPassword = await hash(payload.password, 10);

  await UserModel.create({
    email: invitation.email,
    password: hashedPassword,
    roleId: role._id,
    invitedBy: invitation.invitedBy,
  });

  invitation.acceptedAt = new Date();
  await invitation.save();

  await InvitationModel.updateMany(
    {
      _id: { $ne: invitation._id },
      email: invitation.email,
      acceptedAt: null,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } },
  );

  return {
    email: invitation.email,
    role: invitation.role,
  };
}
