import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layouts/AppLayout';
import { apiFetch } from '@/lib/apiClient';

interface Me {
  id: string;
  email: string;
}

const placeholderCards = [
  { label: 'Total Orders', value: '—' },
  { label: 'Total Customers', value: '—' },
  { label: 'Total Products', value: '—' },
  { label: 'Total Tickets', value: '—' },
];

export default function Dashboard() {
  // Proves the full chain works: frontend session -> backend requireAuth ->
  // Supabase token verification. Real dashboard metrics arrive in Chunk 2+.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<Me>('/auth/me'),
  });

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        {isLoading && 'Verifying backend connection…'}
        {isError && 'Could not reach the backend API. Is it running?'}
        {data && `Backend session verified for ${data.email}.`}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {placeholderCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Orders, Customers, Products and Tickets modules arrive in Chunks 2–5.
      </div>
    </AppLayout>
  );
}
