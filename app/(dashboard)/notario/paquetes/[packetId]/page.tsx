import { notFound } from "next/navigation";
import { requireApproved } from "@/lib/auth/guards";
import { getPacketEvidenceReview } from "@/lib/actions/notary";
import { EvidenceReviewClient } from "@/components/notary/evidence-review-client";

interface Props {
  params: Promise<{ packetId: string }>;
}

export default async function NotarioPacketDetailPage({ params }: Props) {
  const { packetId } = await params;
  const profile = await requireApproved("notary");

  let data;
  try {
    data = await getPacketEvidenceReview(packetId, profile.id);
  } catch {
    notFound();
  }

  return <EvidenceReviewClient data={data} />;
}
