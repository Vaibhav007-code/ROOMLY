/**
 * Shared Error Translator for Roomly Application.
 * Translates raw database exceptions and Supabase error strings into user-friendly, plain language messages.
 */

export function getErrorMessage(error: unknown): string {
  // Always log the actual technical error to console for debugging
  console.error('[Roomly Technical Error]:', error);

  if (!error) {
    return 'Something went wrong while saving. Please try again.';
  }

  const message = typeof error === 'string' 
    ? error 
    : (error as any)?.message || (error as any)?.details || String(error);

  const lowerMsg = message.toLowerCase();

  // 1. Duplicate Room Number
  if (
    lowerMsg.includes('unique constraint') && lowerMsg.includes('room_number') ||
    lowerMsg.includes('rooms_hostel_id_room_number_key') ||
    lowerMsg.includes('duplicate key value violates unique constraint') && lowerMsg.includes('rooms')
  ) {
    return 'A room with this number already exists in this hostel. Please use a different room number.';
  }

  // 2. Duplicate Student Phone Number
  if (
    lowerMsg.includes('a student with this phone number already exists') ||
    lowerMsg.includes('unique(owner_id,phone)') ||
    lowerMsg.includes('students_owner_id_phone_key')
  ) {
    return "A student with this phone number is already registered. Please check if they're already added.";
  }

  // 3. Duplicate Admission Application Phone Number
  if (
    lowerMsg.includes('an application using this phone number already exists') ||
    lowerMsg.includes('pending_admissions_hostel_id_phone_key')
  ) {
    return "An application with this phone number has already been submitted for this hostel.";
  }

  // 4. Room at Full Capacity
  if (
    lowerMsg.includes('room is full') ||
    lowerMsg.includes('room is now full') ||
    lowerMsg.includes('bed_capacity')
  ) {
    return 'This room is already full. Please choose a different room or increase its bed capacity.';
  }

  // 5. Delete Hostel or Room with Active Students
  if (
    lowerMsg.includes('move out all active students before deleting') ||
    lowerMsg.includes('foreign key constraint') && (lowerMsg.includes('hostel') || lowerMsg.includes('room')) ||
    lowerMsg.includes('students_hostel_id_fkey') ||
    lowerMsg.includes('room_assignments_room_id_fkey')
  ) {
    return "This hostel/room still has active students and can't be removed. Please move or remove those students first.";
  }

  // 6. Permission / Ownership Errors
  if (
    lowerMsg.includes('not allowed') ||
    lowerMsg.includes('you do not have access')
  ) {
    return 'You do not have permission to perform this action.';
  }

  // 7. Payment amount validation
  if (lowerMsg.includes('payment amount must be positive')) {
    return 'Please enter a valid positive payment amount.';
  }

  // Generic fallback if message contains raw SQL / Postgres codes
  if (
    lowerMsg.includes('violates foreign key constraint') ||
    lowerMsg.includes('violates unique constraint') ||
    lowerMsg.includes('pgcrypto') ||
    lowerMsg.includes('plpgsql') ||
    lowerMsg.includes('sqlstate')
  ) {
    return 'Something went wrong while processing your request. Please try again.';
  }

  // If it's already a clean string without database noise, return it
  return message;
}
