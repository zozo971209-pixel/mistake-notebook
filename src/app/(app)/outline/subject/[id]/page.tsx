import { SubjectDetail } from "@/components/outline/subject-detail";

export default async function OutlineSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubjectDetail subjectId={id} />;
}
