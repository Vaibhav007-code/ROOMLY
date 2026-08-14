export type MessageTemplate = 'rent_receipt' | 'rent_reminder' | 'contract' | 'student_invite';

function normalisePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  throw new Error('Enter a valid phone number, including a 10-digit Indian mobile number.');
}

export function buildWhatsAppLink(phone: string, templateType: MessageTemplate, data: Record<string, any>): string {
  const messages: Record<MessageTemplate, string> = {
    rent_receipt: `Hi ${data.name}, we received your rent payment of ₹${data.amount} for ${data.hostelName || 'your hostel'}. Thank you.`,
    rent_reminder: `Hi ${data.name}, your rent of ₹${data.amount} for ${data.hostelName || 'your hostel'} was due on ${data.dueDate || data.due}. Please pay at your earliest convenience.`,
    contract: `Hi ${data.name}, welcome to ${data.hostelName}! Your contract is ready: ${data.contractUrl}. Security deposit: ₹${data.deposit}, duration: ${data.duration} months.`,
    student_invite: `Hi ${data.name}, set up your HostelFlow resident login using this one-time link: ${data.inviteUrl}. This link expires in 7 days.`,
  };
  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(messages[templateType])}`;
}

export { normalisePhone };
