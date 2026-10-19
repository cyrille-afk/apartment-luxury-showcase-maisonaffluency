import { z } from 'zod';

export const roomConsultationSchema = z.object({
  room: z.enum(['living-room', 'dining-room', 'bedroom', 'office', 'outdoor']),
  name: z.string().trim().min(1, 'Please enter your name.').max(100),
  email: z.string().trim().email('Please enter a valid email.').max(255),
  company: z.string().trim().min(1, 'Please enter your studio or firm.').max(150),
  profession: z.enum(['architect', 'interior-designer']),
  phone: z.string().trim().max(50).regex(/^[+\d\s().-]*$/, 'Please enter a valid phone number.'),
  project: z.string().trim().max(200),
  location: z.string().trim().max(200),
  message: z.string().trim().min(1, 'Please tell us about your space.').max(4000),
  website: z.string().max(0),
});

export type RoomConsultationInput = z.infer<typeof roomConsultationSchema>;