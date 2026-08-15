export type MessageTemplate = 'rent_receipt' | 'rent_reminder' | 'contract' | 'student_invite';

function normalisePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  throw new Error('Enter a valid phone number, including a 10-digit Indian mobile number.');
}

export function buildWhatsAppLink(phone: string, templateType: MessageTemplate, data: Record<string, any>): string {
  const hostel = data.hostelName || data.hostel || 'your hostel';
  const name = data.name || 'Resident';

  const messages: Record<MessageTemplate, string> = {
    rent_reminder: [
      `Dear ${name},`,
      ``,
      `This is a friendly reminder that your rent payment of ₹${data.amount} for *${hostel}* is due${data.dueDate ? ` on ${data.dueDate}` : ''}.`,
      ``,
      `Please make the payment at your earliest convenience. If you have already paid, kindly ignore this message.`,
      ``,
      `*Room:* ${data.room || data.roomNumber || 'As assigned'}`,
      `*Amount Due:* ₹${data.amount}`,
      `*Due Date:* ${data.dueDate || data.due || 'As notified'}`,
      ``,
      `Thank you,`,
      `*${hostel} Management*`,
    ].join('\n'),

    rent_receipt: [
      `Dear ${name},`,
      ``,
      `We have received your rent payment of *₹${data.amount}* for *${hostel}*. Thank you!`,
      ``,
      `*Room:* ${data.room || data.roomNumber || 'As assigned'}`,
      `*Amount Paid:* ₹${data.amount}`,
      `*Date:* ${data.date || new Date().toLocaleDateString('en-IN')}`,
      ``,
      `Your payment has been recorded. Please keep this message as your receipt.`,
      ``,
      `Thank you for your timely payment.`,
      `*${hostel} Management*`,
    ].join('\n'),

    contract: [
      `Dear ${name},`,
      ``,
      `Welcome to *${hostel}*! We are pleased to have you as a resident.`,
      ``,
      `Your tenancy agreement has been prepared. Please review and keep it for your records:`,
      `📄 ${data.contractUrl}`,
      ``,
      `*Tenancy Details:*`,
      `*Security Deposit:* ₹${data.deposit}`,
      `*Contract Duration:* ${data.duration} months`,
      ``,
      `If you have any questions, please don't hesitate to reach out to us.`,
      ``,
      `Warm regards,`,
      `*${hostel} Management*`,
    ].join('\n'),

    student_invite: [
      `Dear ${name},`,
      ``,
      `Welcome to *${hostel || 'your hostel'}*! Your resident account is ready.`,
      ``,
      `Please use the link below to set up your login and access the resident portal:`,
      `🔗 ${data.inviteUrl}`,
      ``,
      `*Important:* This link expires in 7 days. Please complete your setup before then.`,
      ``,
      `Through the portal you can:`,
      `• View your rent payment history`,
      `• Download your tenancy agreement`,
      `• Submit maintenance complaints`,
      ``,
      `If you did not request this, please ignore this message.`,
      ``,
      `Regards,`,
      `*${hostel || 'Hostel'} Management*`,
    ].join('\n'),
  };

  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(messages[templateType])}`;
}

export { normalisePhone };
