import client from '../api/client';
import type { AuditResponse } from '../api/types';
import { buildAuditPdf, actionLabel } from './audit-pdf';

export { actionLabel };
export interface AuditQuery { from?: string; to?: string; action?: string }

export async function fetchAudit(q: AuditQuery): Promise<AuditResponse> {
  const { data } = await client.get<AuditResponse>('/sysadmin/audit', { params: q });
  return data;
}

/** Fetch the audit log for the range and produce a professional PDF download. */
export async function downloadAuditPdf(q: AuditQuery, generatedBy: string): Promise<{ total: number; shown: number; capped: boolean }> {
  const res = await fetchAudit(q);
  const doc = buildAuditPdf(res.logs, {
    from: q.from, to: q.to, action: q.action,
    generatedBy, total: res.total, capped: res.capped, max: res.max,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`ANANTA_MES_Audit_Trail_${stamp}.pdf`);
  return { total: res.total, shown: res.logs.length, capped: res.capped };
}
