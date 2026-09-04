"use client";

import { FormEvent, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";
import Modal from "@/components/common/modal";
import { IconTrash, IconUserPlus } from "@/components/common/icons";
import Spinner from "@/components/common/spinner";
import Tooltip from "@/components/common/tooltip";
import { apiRequest } from "@/lib/api";
import { formatFleetTimestamp } from "@/lib/fleet-utils";
import { cn } from "@/lib/utils";
import type { AccountInvitation, AccountMember, AccountRole, AccountsWorkspace } from "@/types/account";

const ROLE_OPTIONS: Array<{ value: AccountRole; label: string; description: string }> = [
  { value: "user", label: "User", description: "Can invite teammates and remove other users" },
  { value: "admin", label: "Admin", description: "Can invite any role and remove any account" },
];

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "User";
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
        isAdmin ? "bg-primary-muted text-primary" : "bg-surface-muted text-muted",
      )}
    >
      {roleLabel(role)}
    </span>
  );
}

function formatExpiry(value: string, expired: boolean) {
  if (expired) {
    return "Expired";
  }

  const diffMs = new Date(value).getTime() - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (days <= 0) {
    return "Expires today";
  }

  if (days === 1) {
    return "Expires in 1 day";
  }

  return `Expires in ${days} days`;
}

export default function AccountsSettingsPanel({
  workspace,
  loading,
  onReload,
}: {
  workspace: AccountsWorkspace;
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("user");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AccountMember | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AccountInvitation | null>(null);

  const roleOptions = useMemo(
    () => (workspace.currentUser.canInviteAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((option) => option.value === "user")),
    [workspace.currentUser.canInviteAdmin],
  );

  const members = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return workspace.members;
    }

    return workspace.members.filter(
      (member) => member.email.toLowerCase().includes(needle) || member.role.toLowerCase().includes(needle),
    );
  }, [query, workspace.members]);

  const invitations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return workspace.invitations;
    }

    return workspace.invitations.filter((invitation) => invitation.email.toLowerCase().includes(needle));
  }, [query, workspace.invitations]);

  function resetInviteForm() {
    setInviteEmail("");
    setInviteRole("user");
    setInviteMessage("");
    setInviteError(false);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteLoading(true);
    setInviteMessage("");
    setInviteError(false);

    const result = await apiRequest("/api/v1/accounts/invitations", {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    setInviteLoading(false);

    if (!result.success) {
      setInviteError(true);
      setInviteMessage(result.message || "Unable to send invitation");
      return;
    }

    setInviteOpen(false);
    resetInviteForm();
    setActionError(false);
    setActionMessage(result.message || `Invitation sent to ${inviteEmail}`);
    await onReload();
  }

  async function handleResend(invitation: AccountInvitation) {
    setBusyId(invitation.id);
    setActionMessage("");
    setActionError(false);

    const result = await apiRequest(`/api/v1/accounts/invitations/${invitation.id}/resend`, {
      method: "POST",
    });

    setBusyId("");

    if (!result.success) {
      setActionError(true);
      setActionMessage(result.message || "Unable to resend invitation");
      return;
    }

    setActionMessage(result.message || `Invitation resent to ${invitation.email}`);
    await onReload();
  }

  async function handleRevoke() {
    if (!pendingRevoke) {
      return;
    }

    setBusyId(pendingRevoke.id);
    setActionMessage("");
    setActionError(false);

    const result = await apiRequest(`/api/v1/accounts/invitations/${pendingRevoke.id}`, {
      method: "DELETE",
    });

    setBusyId("");
    setPendingRevoke(null);

    if (!result.success) {
      setActionError(true);
      setActionMessage(result.message || "Unable to revoke invitation");
      return;
    }

    setActionMessage(`Invitation to ${pendingRevoke.email} was revoked`);
    await onReload();
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return;
    }

    setBusyId(pendingDelete.id);
    setActionMessage("");
    setActionError(false);

    const result = await apiRequest(`/api/v1/accounts/${pendingDelete.id}`, {
      method: "DELETE",
    });

    setBusyId("");
    setPendingDelete(null);

    if (!result.success) {
      setActionError(true);
      setActionMessage(result.message || "Unable to remove account");
      return;
    }

    setActionMessage(`${pendingDelete.email} was removed`);
    await onReload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Accounts</h2>
          <p className="mt-1 text-sm text-muted">
            Access is by invitation only. Admins and users can both invite teammates. Users cannot remove admins;
            admins can remove any other account.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <IconUserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </div>

      {actionMessage ? <Alert variant={actionError ? "error" : "success"}>{actionMessage}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search accounts"
          className="max-w-xs"
          aria-label="Search accounts"
        />
        {loading ? <Spinner label="Refreshing..." /> : null}
      </div>

      <section className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            <p className="mt-0.5 text-xs text-muted">{members.length} with access</p>
          </div>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                  No members match that search.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{member.email}</p>
                    {member.isCurrentUser ? <p className="mt-0.5 text-xs text-muted">You</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{formatFleetTimestamp(member.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {member.isCurrentUser ? (
                      <span className="text-xs text-muted">Current session</span>
                    ) : member.canDelete ? (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === member.id}
                        onClick={() => setPendingDelete(member)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : (
                      <Tooltip content={member.deleteBlockedReason || "You cannot remove this account"} align="end">
                        <span>
                          <Button size="sm" variant="danger" disabled>
                            <IconTrash className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pending invitations</h3>
            <p className="mt-0.5 text-xs text-muted">
              {invitations.length === 0 ? "No outstanding invites" : `${invitations.length} waiting to join`}
            </p>
          </div>
        </div>
        {invitations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Invite a teammate to add another account.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{invitation.email}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Invited by {invitation.invitedByEmail ?? "a teammate"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={invitation.role} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {formatExpiry(invitation.expiresAt, invitation.expired)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {invitation.canResend ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === invitation.id}
                          onClick={() => void handleResend(invitation)}
                        >
                          Resend
                        </Button>
                      ) : null}
                      {invitation.canRevoke ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === invitation.id}
                          onClick={() => setPendingRevoke(invitation)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!inviteLoading) {
            setInviteOpen(false);
            resetInviteForm();
          }
        }}
        title="Invite a teammate"
        subtitle="They will receive an email with a link to create their password."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={inviteLoading}
              onClick={() => {
                setInviteOpen(false);
                resetInviteForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="invite-account-form" disabled={inviteLoading}>
              {inviteLoading ? "Sending..." : "Send invitation"}
            </Button>
          </div>
        }
      >
        <form id="invite-account-form" className="space-y-4 px-4 py-4" onSubmit={handleInvite}>
          {inviteMessage ? <Alert variant={inviteError ? "error" : "success"}>{inviteMessage}</Alert> : null}
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@company.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <Label id="invite-role-label">Role</Label>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="invite-role-label">
              {roleOptions.map((option) => {
                const selected = inviteRole === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setInviteRole(option.value)}
                    className={cn(
                      "rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition",
                      selected
                        ? "border-primary bg-primary-muted"
                        : "border-border bg-surface hover:border-primary/30 hover:bg-primary-muted/40",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{option.description}</p>
                  </button>
                );
              })}
            </div>
            {!workspace.currentUser.canInviteAdmin ? (
              <p className="mt-1.5 text-xs text-muted">Users can invite other users. Only admins can grant admin access.</p>
            ) : null}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove account"
        subtitle={pendingDelete ? `This will immediately revoke access for ${pendingDelete.email}.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={Boolean(busyId)} onClick={() => void handleDelete()}>
              Remove account
            </Button>
          </div>
        }
      >
        <p className="px-4 py-4 text-sm leading-relaxed text-muted">
          They will no longer be able to sign in. You can invite them again later if needed.
        </p>
      </Modal>

      <Modal
        open={Boolean(pendingRevoke)}
        onClose={() => setPendingRevoke(null)}
        title="Revoke invitation"
        subtitle={pendingRevoke ? `The invite sent to ${pendingRevoke.email} will stop working.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingRevoke(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={Boolean(busyId)} onClick={() => void handleRevoke()}>
              Revoke invite
            </Button>
          </div>
        }
      >
        <p className="px-4 py-4 text-sm leading-relaxed text-muted">
          The recipient will not be able to create an account with the existing link.
        </p>
      </Modal>
    </div>
  );
}
