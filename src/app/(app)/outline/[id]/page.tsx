import { NodeDetail } from "@/components/outline/node-detail";

export default async function OutlineNodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NodeDetail nodeId={id} />;
}
