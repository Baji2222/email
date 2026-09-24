
import { AppLayout } from '@/components/layouts/AppLayout';

export default function ComingSoon({ title, chunk }: { title: string; chunk: string }) {
  return (
    <AppLayout>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        This module is implemented in {chunk}.
      </div>
    </AppLayout>
  );
}
