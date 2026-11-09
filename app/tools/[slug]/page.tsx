import { notFound } from "next/navigation";
import { tools, toolBySlug } from "@/lib/documents/catalog";
import { DocumentWorkspace } from "@/components/documents/workspace";
export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${toolBySlug(slug)?.title || "Tools"} · ACE Studio` };
}
export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  return <DocumentWorkspace tool={tool} />;
}
