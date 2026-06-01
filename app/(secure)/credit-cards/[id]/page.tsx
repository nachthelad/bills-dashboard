import { CreditCardDetail } from "@/components/credit-cards/credit-card-detail";

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreditCardDetail cardId={id} />;
}
