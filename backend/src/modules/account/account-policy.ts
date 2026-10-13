import {
  isAdminRole,
  isDispatcherRole,
  USER_ROLE_NAME,
  type AccountRole,
} from "../role/constants";

export type AccountActor = {
  id: string;
  role: string;
};

export type AccountTarget = {
  id: string;
  role: string;
};

export function canInviteAsRole(actorRole: string, invitedRole: AccountRole) {
  if (isDispatcherRole(actorRole)) {
    return false;
  }

  if (invitedRole === "admin" || invitedRole === "dispatcher") {
    return isAdminRole(actorRole);
  }

  return isAdminRole(actorRole) || actorRole === USER_ROLE_NAME;
}

export function describeDeleteBlock(args: {
  actor: AccountActor;
  target: AccountTarget;
  adminCount: number;
}) {
  if (args.actor.id === args.target.id) {
    return "You cannot remove your own account";
  }

  if (isDispatcherRole(args.actor.role)) {
    return "Dispatchers cannot manage accounts";
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
  if (isDispatcherRole(args.actor.role)) {
    return false;
  }

  return isAdminRole(args.actor.role) || args.actor.id === args.invitedById;
}

export function canAssignDispatcherFleet(actorRole: string) {
  return isAdminRole(actorRole);
}
