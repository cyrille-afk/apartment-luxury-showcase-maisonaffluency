export function initializationEmails(rows: string[]) {
  const emails = [...new Set(rows.map(row => row.trim().toLowerCase()).filter(Boolean))];
  if (emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Enter a valid email address for each teammate, or remove the row.");
  return emails;
}

export function canInitializeStep(step: number, studioName: string, projectName: string) {
  return step === 1 ? !!studioName.trim() : step === 3 ? !!projectName.trim() : true;
}