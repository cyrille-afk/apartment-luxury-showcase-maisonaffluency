export function shouldOfferArchitecturalIntake(input: {
  builderSubmit: boolean;
  completed: boolean;
  hasProposal: boolean;
  builderOpen: boolean;
  hasAttachments: boolean;
}): boolean {
  return !input.builderSubmit && !input.completed && !input.hasProposal && !input.builderOpen && !input.hasAttachments;
}