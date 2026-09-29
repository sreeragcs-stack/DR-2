export const CLASSIFICATION_FIXTURE_VERSION = 'falcon-real-communications-v1';

export type ClassificationFixture = {
  inputOrder: number;
  quote: string;
  sourceType: 'Call' | 'Email' | 'Ticket comment';
  sourceDate: string;
  expectedOutcome: 'consistent' | 'clarification' | 'deviation' | 'net-new' | null;
  expectedRequirementId: string | null;
  matchesExpected: boolean | null;
};

const emptyAudit = { expectedOutcome: null, expectedRequirementId: null, matchesExpected: null } as const;

export const classificationFixtures: ClassificationFixture[] = [
  { inputOrder: 1, quote: "Any chance we could push Thursday's walkthrough to Friday instead? Something came up on our end this week.", sourceType: 'Email', sourceDate: '21 August 2026', ...emptyAudit },
  { inputOrder: 2, quote: 'Just double-checking - receipts can be a photo from a phone or a PDF, not just a scanned copy, right?', sourceType: 'Call', sourceDate: '24 August 2026', ...emptyAudit },
  { inputOrder: 3, quote: 'When you say search results come back quickly, what does that actually mean in seconds? Our team wants something concrete to test against.', sourceType: 'Email', sourceDate: '27 August 2026', ...emptyAudit },
  { inputOrder: 4, quote: 'Our external audit firm starts their fiscal year-end review in a couple of months - could we get them a read-only login that can see everything but not touch anything?', sourceType: 'Ticket comment', sourceDate: '29 August 2026', ...emptyAudit },
  { inputOrder: 5, quote: 'Could someone resend a copy of the signed SOW? Our finance team needs it on file for an internal review.', sourceType: 'Ticket comment', sourceDate: '1 September 2026', ...emptyAudit },
  { inputOrder: 6, quote: 'How exactly do employees find out their claim status changed - is that an email, a text, or something inside the app itself?', sourceType: 'Call', sourceDate: '4 September 2026', ...emptyAudit },
  { inputOrder: 7, quote: 'Just confirming for our store managers - claims get paid out every Friday, correct?', sourceType: 'Email', sourceDate: '7 September 2026', ...emptyAudit },
  { inputOrder: 8, quote: "Our regional HR team ran a quick pulse survey with store staff last month, and once-a-week payouts came up as their top ask for the new system - could we move to twice-weekly instead? We'd really like this built in before go-live, it's come up a lot in planning conversations.", sourceType: 'Email', sourceDate: '10 September 2026', ...emptyAudit },
  { inputOrder: 9, quote: 'Quick one on the reporting dashboard - how far back can the date range go? Can we pull a full year, or is there a cap?', sourceType: 'Ticket comment', sourceDate: '14 September 2026', ...emptyAudit },
  { inputOrder: 10, quote: "Our compliance team just got word from a regulator in one of our regions that payment records will need to be kept for seven years, not three, once the new system goes live. We need this built in before go-live - it's a regulatory requirement, not optional.", sourceType: 'Call', sourceDate: '18 September 2026', ...emptyAudit },
  { inputOrder: 11, quote: 'One thing that came up when we surveyed store staff ahead of rollout - a good chunk of them are more comfortable working in Spanish than English. Any chance the claim form could be offered in Spanish too? Would be great to have in the next release or two, no huge rush.', sourceType: 'Email', sourceDate: '23 September 2026', ...emptyAudit },
  { inputOrder: 12, quote: "Small one, whenever it's convenient - could an approver leave a short note back to the employee on a claim, like 'missing itemized receipt'? Not urgent at all, just something that'd be nice to have eventually.", sourceType: 'Email', sourceDate: '29 September 2026', ...emptyAudit },
];
