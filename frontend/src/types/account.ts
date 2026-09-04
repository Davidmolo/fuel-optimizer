export type AccountRole = "admin" | "user";

export type AccountMember = {
  id: string;
  email: string;
  role: AccountRole | string;
  createdAt: string;
  isCurrentUser: boolean;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type AccountInvitation = {
  id: string;
  email: string;
  role: AccountRole | string;
  invitedByEmail: string | null;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
  canRevoke: boolean;
  canResend: boolean;
};

export type AccountsWorkspace = {
  currentUser: {
    id: string;
    email: string;
    role: AccountRole | string;
    canInviteAdmin: boolean;
  };
  members: AccountMember[];
  invitations: AccountInvitation[];
};

export type InvitationPreview = {
  email: string;
  role: AccountRole | string;
  invitedByEmail: string | null;
  expiresAt: string;
};
