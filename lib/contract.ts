import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const TEMPLATE_WIDTH = 1055;
const TEMPLATE_HEIGHT = 1491;
const NAVY = rgb(20 / 255, 35 / 255, 65 / 255);
const BLACK = rgb(0, 0, 0);

export interface ContractData {
  hostelName: string;
  ownerName?: string;
  contractNo: string;
  contractDate: string;
  studentName: string;
  phoneNumber: string;
  email: string;
  college: string;
  courseYear: string;
  roomAllotted: string;
  roomType: string;
  bedNumber: string;
  admissionDatetime: string;
  monthlyRent: string;
  securityDeposit: string;
  paymentMode: string;
  contractMonths: string;
  validityFrom: string;
  validityTo: string;
}

export async function generateContractPdf(data: ContractData): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), 'public', 'contract-template.png');
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(templateBytes);
  const page = pdfDoc.addPage([TEMPLATE_WIDTH, TEMPLATE_HEIGHT]);

  // Draw the template as the full-page background
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
  });

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // pdf-lib's Y origin is bottom-left; our coordinates below are top-left (from PIL/OCR).
  // Convert every Y with: TEMPLATE_HEIGHT - y
  const drawValue = (text: string, x: number, yFromTop: number, size = 20, font = fontRegular, color = BLACK) => {
    page.drawText(text ?? '', {
      x,
      y: TEMPLATE_HEIGHT - yFromTop,
      size,
      font,
      color,
    });
  };

  // Hostel name — centered, letterhead-style, under the main title
  const hostelNameUpper = (data.hostelName || '').toUpperCase();
  const hostelNameWidth = fontBold.widthOfTextAtSize(hostelNameUpper, 22);
  drawValue(hostelNameUpper, (TEMPLATE_WIDTH - hostelNameWidth) / 2, 203, 22, fontBold, NAVY);

  // Contract details row
  drawValue(data.contractNo, 225, 341);
  drawValue(data.contractDate, 760, 341);

  // Student details
  drawValue(data.studentName, 350, 453);
  drawValue(data.phoneNumber, 350, 494);
  drawValue(data.email, 350, 533);
  drawValue(data.college, 350, 573);
  drawValue(data.courseYear, 350, 614);

  // Stay details
  drawValue(data.roomAllotted, 350, 710);
  drawValue(data.roomType, 350, 750);
  drawValue(data.bedNumber, 350, 791);
  drawValue(data.admissionDatetime, 350, 832);

  // Payment details
  drawValue(data.monthlyRent, 380, 929);
  drawValue(data.securityDeposit, 380, 970);
  drawValue(data.paymentMode, 350, 1010);

  // Contract / security validity
  drawValue(data.contractMonths, 400, 1100);
  drawValue(data.validityFrom, 600, 1100);
  drawValue(data.validityTo, 780, 1100);

  // Owner Name on Owner / Manager Signature line
  if (data.ownerName) {
    const ownerNameText = data.ownerName;
    const ownerNameWidth = fontRegular.widthOfTextAtSize(ownerNameText, 16);
    const ownerX = 706 - ownerNameWidth / 2;
    drawValue(ownerNameText, ownerX, 1300, 16, fontRegular, BLACK);
  }

  return pdfDoc.save();
}
