import { z } from "zod";

export const submitSupportTicketSchema = z.object({
  subject: z.string().trim().min(3, "Subject is required.").max(200),
  body: z
    .string()
    .trim()
    .min(10, "Please describe your issue in at least 10 characters.")
    .max(8000),
});

export type SubmitSupportTicketInput = z.infer<typeof submitSupportTicketSchema>;

export const replySupportTicketSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket."),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(8000),
});

export type ReplySupportTicketInput = z.infer<typeof replySupportTicketSchema>;

export const adminReplySupportTicketSchema = replySupportTicketSchema.extend({
  markResolved: z.boolean().optional(),
});

export type AdminReplySupportTicketInput = z.infer<
  typeof adminReplySupportTicketSchema
>;

export const supportTicketIdSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket."),
});
