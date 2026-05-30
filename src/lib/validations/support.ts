import { z } from "zod";

import { SUPPORT_TICKET_IMAGES_MAX } from "@/lib/support-ticket-images";

const optionalUrlField = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || z.string().url().safeParse(v).success,
    "Enter a valid URL.",
  );

export const updateHubContactSettingsSchema = z.object({
  supportEmail: z
    .string()
    .trim()
    .max(320)
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "Enter a valid support email.",
    ),
  supportPhone: z.string().trim().max(40),
  whatsappNumber: z.string().trim().max(40),
  instagramUrl: optionalUrlField,
  facebookUrl: optionalUrlField,
  xUrl: optionalUrlField,
  tiktokUrl: optionalUrlField,
  publicIntro: z.string().trim().max(2000),
  businessHours: z.string().trim().max(500),
});

export type UpdateHubContactSettingsInput = z.infer<
  typeof updateHubContactSettingsSchema
>;

const supportTicketImageUrlsSchema = z
  .array(z.string().url())
  .max(SUPPORT_TICKET_IMAGES_MAX);

export const createSupportTicketSchema = z
  .object({
    subject: z.string().trim().min(3, "Subject is too short.").max(200),
    body: z.string().trim().max(8000),
    imageUrls: supportTicketImageUrlsSchema.optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.body.length < 10 && data.imageUrls.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Describe your issue in at least 10 characters or attach an image.",
        path: ["body"],
      });
    }
  });

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const supportTicketReplySchema = z
  .object({
    ticketId: z.string().uuid("Invalid ticket."),
    body: z.string().trim().max(8000),
    imageUrls: supportTicketImageUrlsSchema.optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.body.length < 1 && data.imageUrls.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a message or attach an image.",
        path: ["body"],
      });
    }
  });

export type SupportTicketReplyInput = z.infer<typeof supportTicketReplySchema>;

export const SUPPORT_TICKET_STATUS_VALUES = [
  "open",
  "awaiting_staff",
  "awaiting_customer",
  "resolved",
  "closed",
] as const;

export const adminSupportTicketStatusSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket."),
  status: z.enum(SUPPORT_TICKET_STATUS_VALUES),
});

export type AdminSupportTicketStatusInput = z.infer<
  typeof adminSupportTicketStatusSchema
>;
