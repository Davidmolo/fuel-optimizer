import { isAdminRole, type AccountRole } from "../role/constants";

export type AccountActor = {
  id: string;
  role: string;
};

export type AccountTarget = {
  id: string;
  role: string;
};

export function canInviteAsRole(actorRole: string, invitedRole: AccountRole) {
  if (invitedRole === "user") {
    return true;
  }

  return isAdminRole(actorRole);
}

export function describeDeleteBlock(args: {
  actor: AccountActor;
  target: AccountTarget;
  adminCount: number;
}) {
  if (args.actor.id === args.target.id) {
    return "You cannot remove your own account";
  }

  if (!isAdminRole(args.actor.role) && isAdminRole(args.target.role)) {
    return "Users cannot remove admin accounts";
  }

  if (isAdminRole(args.target.role) && args.adminCount <= 1) {
    return "The last admin account cannot be removed";
  }

  return null;
}

export function canDeleteAccount(args: {
  actor: AccountActor;
  target: AccountTarget;
  adminCount: number;
}) {
  return describeDeleteBlock(args) === null;
}

export function canRevokeInvitation(args: { actor: AccountActor; invitedById: string }) {
  return isAdminRole(args.actor.role) || args.actor.id === args.invitedById;
}
