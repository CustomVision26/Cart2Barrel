import { z } from "zod";

import { SUPPORT_TICKET_IMAGES_MAX } from "@/lib/support-ticket-images";
import { SUPPORT_TICKET_PRODUCT_LINKS_MAX } from "@/lib/support-ticket-product-links";

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

const supportTicketProductLinksSchema = z
  .array(z.string().url())
  .max(SUPPORT_TICKET_PRODUCT_LINKS_MAX);

function refineSupportMessageContent(
  data: { body: string; imageUrls: string[]; productLinks: string[] },
  ctx: z.RefinementCtx,
  minBodyWhenEmptyAttachments: number,
) {
  const hasImages = data.imageUrls.length > 0;
  const hasLinks = data.productLinks.length > 0;
  if (data.body.length < minBodyWhenEmptyAttachments && !hasImages && !hasLinks) {
    ctx.addIssue({
      code: "custom",
      message:
        minBodyWhenEmptyAttachments > 1
          ? "Describe your issue in at least 10 characters, or attach an image or product link."
          : "Enter a message, or attach an image or product link.",
      path: ["body"],
    });
  }
}

export const createSupportTicketSchema = z
  .object({
    subject: z.string().trim().min(3, "Subject is too short.").max(200),
    body: z.string().trim().max(8000),
    imageUrls: supportTicketImageUrlsSchema.optional().default([]),
    productLinks: supportTicketProductLinksSchema.optional().default([]),
  })
  .superRefine((data, ctx) => refineSupportMessageContent(data, ctx, 10));

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const supportTicketReplySchema = z
  .object({
    ticketId: z.string().uuid("Invalid ticket."),
    body: z.string().trim().max(8000),
    imageUrls: supportTicketImageUrlsSchema.optional().default([]),
    productLinks: supportTicketProductLinksSchema.optional().default([]),
  })
  .superRefine((data, ctx) => refineSupportMessageContent(data, ctx, 1));

export type SupportTicketReplyInput = z.infer<typeof supportTicketReplySchema>;

export const adminCreateSupportTicketSchema = z
  .object({
    customerClerkUserId: z.string().trim().min(1, "Select a customer."),
    subject: z.string().trim().min(3, "Subject is too short.").max(200),
    body: z.string().trim().max(8000),
    imageUrls: supportTicketImageUrlsSchema.optional().default([]),
    productLinks: supportTicketProductLinksSchema.optional().default([]),
  })
  .superRefine((data, ctx) => refineSupportMessageContent(data, ctx, 1));

export type AdminCreateSupportTicketInput = z.infer<
  typeof adminCreateSupportTicketSchema
>;

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
