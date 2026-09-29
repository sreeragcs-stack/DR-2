import type { InferInsertModel } from 'drizzle-orm';
import { drifts, requirements } from './schema';

export const falconRequirements: InferInsertModel<typeof requirements>[] = [
  { id: 'R-01', title: 'User Roles & Accounts', prdText: 'The system shall support three roles - Employee, Approver, and Admin. Each user account is associated with exactly one role, and the role determines which actions and screens are available to that user.' },
  { id: 'R-02', title: 'Admin Authentication', prdText: 'Admin users authenticate with a username and password. Sessions expire after 30 minutes of inactivity and require re-authentication.' },
  { id: 'R-03', title: 'Expense Claim Submission', prdText: 'Employees shall submit expense claims containing: date incurred, amount, category, a short description, and a scanned or photographed receipt attachment (JPG, PNG, or PDF, max 10MB).' },
  { id: 'R-04', title: 'Claim Categorization', prdText: 'Each claim line item must be assigned one of the predefined expense categories before it can be submitted. Predefined categories: Travel, Lodging, Meals & Entertainment, Client Entertainment, Office Supplies, Mileage, and Other (requires a written justification).' },
  { id: 'R-05', title: 'Search Performance', prdText: 'Search results return quickly.' },
  { id: 'R-06', title: 'Approval Workflow', prdText: 'Approvals: a single approver signs off each payment batch. The approver reviews all claims assigned to their store or region and approves or rejects the batch as a whole.' },
  { id: 'R-07', title: 'Status Notifications', prdText: 'Employees are notified of claim status changes (Submitted, Approved, Rejected, Paid).' },
  { id: 'R-08', title: 'Reimbursement Checkout', prdText: 'Checkout supports USD transactions. Employee-submitted claims are reimbursed in United States Dollars only.' },
  { id: 'R-09', title: 'Payment Batch Scheduling', prdText: 'Approved claims are grouped into a payment batch and processed on a weekly cycle, every Friday.' },
  { id: 'R-10', title: 'Audit Trail', prdText: "Every status change and approval decision is logged with a timestamp and the acting user's ID. Audit records are retained for a minimum of three years." },
  { id: 'R-11', title: 'Finance Ledger Sync', prdText: 'Approved and paid claim data is synced to the Northwind Finance ledger via a scheduled export, run nightly.' },
  { id: 'R-12', title: 'Reporting Dashboard', prdText: 'Reporting: on-screen dashboard only. Admin and Approver roles can view a dashboard summarizing claim volume, status breakdown, and total reimbursed amount for a selected date range.' },
];

export const falconDrifts: InferInsertModel<typeof drifts>[] = [];
