import CredentialDocumentViewer from "@/components/admin/CredentialDocumentViewer";
export default function ViewerTest() {
  return (
    <div className="p-4">
      <CredentialDocumentViewer url="/guides/studio-sourcing.pdf" fileName="sample.pdf" />
    </div>
  );
}
