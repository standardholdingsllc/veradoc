import "server-only";

/**
 * MVP: synchronous job execution.
 * TODO Section 15: Replace with async job queue (Supabase Queues, Inngest, etc.)
 */
export async function enqueueEvidenceReport(packetId: string): Promise<void> {
  console.log(`[Jobs] Evidence report requested for packet ${packetId}`);
  // Placeholder: the actual evidence report generation depends on Section 14/15.
  // For now, log and return.
}
