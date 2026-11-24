import { z } from 'zod';

export const VISITOR_PURPOSES = [
  'Study / Workspace Visit',
  'Meeting',
  'Enquiry',
  'Admission Enquiry',
  'Parent Visit',
  'Other',
] as const;

// phone/whatsapp: 10-15 digits after removing formatting
const phoneField = z
  .string()
  .min(1, 'Required')
  .transform((v) => v.trim())
  .refine((v) => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15, {
    message: 'Must be 10-15 digits',
  });

export const createVisitorSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  phone_number: phoneField,
  whatsapp_number: phoneField,
  email: z.string().trim().email('Invalid email'),
  purpose: z.enum(VISITOR_PURPOSES, 'Invalid purpose'),
  company: z.string().trim().min(1, 'Company is required'),
  persons: z.number().int().min(1),
  visit_date_time: z
    .string()
    .datetime({ offset: true })
    .or(z.string().datetime()),
  notes: z.string().optional(),
});

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;

export const listVisitorsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['checked_in', 'checked_out']).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
});

export type ListVisitorsQuery = z.infer<typeof listVisitorsQuerySchema>;

export const updateVisitorStatusSchema = z.object({
  status: z.enum(['checked_in', 'checked_out']),
});
