import { AdminMessages } from "./AdminMessages";
import { AdminStreams } from "./AdminStreams";

export function AdminPanel() {
  return (
    <div className="min-h-screen bg-bg-base p-4 text-white md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-xl font-bold">管理画面</h1>
        <div className="grid gap-6 lg:grid-cols-[minmax(360px,1fr)_2fr]">
          <AdminStreams />
          <AdminMessages />
        </div>
      </div>
    </div>
  );
}
