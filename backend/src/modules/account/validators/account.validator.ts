import { z } from "zod";
import { ACCOUNT_ROLES } from "../../role/constants";

const emptyParts = {
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
};

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Valid id is required");
const invitationTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{64}$/, "Valid invitation token is required");

export const listAccountsSchema = z.object({
  body: z.object({}).optional().default({}),
  ...emptyParts,
});

export const inviteAccountSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    role: z.enum(ACCOUNT_ROLES),
  }),
  ...emptyParts,
});

export const invitationIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    invitationId: objectIdSchema,
  }),
  query: z.object({}).optional().default({}),
});

export const deleteAccountSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    accountId: objectIdSchema,
  }),
  query: z.object({}).optional().default({}),
});

export const invitationTokenParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    token: invitationTokenSchema,
  }),
  query: z.object({}).optional().default({}),
});

export const acceptInvitationSchema = z.object({
  body: z
    .object({
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string().min(1, "Confirm password is required"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
  params: z.object({
    token: invitationTokenSchema,
  }),
  query: z.object({}).optional().default({}),
});
