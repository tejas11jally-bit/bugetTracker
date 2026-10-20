import { QuickAdd } from "@/components/quick-add";
import { quickAddData } from "@/lib/quick-add-data";
import { Page } from "@/components/ui";

export default async function AddPage() {
  return (
    <Page title="Quick add">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-4">
        <QuickAdd data={await quickAddData()} standalone />
      </div>
    </Page>
  );
}
