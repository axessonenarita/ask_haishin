import { AdminMessages } from "./AdminMessages";
import { AdminStreams } from "./AdminStreams";

export function AdminPanel() {
  return (
    <div className="min-h-screen bg-bg-base p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-xl font-bold">管理画面</h1>
        <AdminStreams />
        <AdminMessages />
      </div>
    </div>
  );
}
