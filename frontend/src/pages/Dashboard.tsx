import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layouts/AppLayout';
import { apiFetch } from '@/lib/apiClient';

interface Me {
  id: string;
  email: string;
}

interface ListResponse {
  data: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const dashboardCards = [
  { key: 'orders', label: 'Total Orders' },
  { key: 'customers', label: 'Total Customers' },
  { key: 'products', label: 'Total Products' },
  { key: 'tickets', label: 'Total Tickets' },
] as const;

export default function Dashboard() {
  // Verify the logged-in session.
  const {
    data: me,
    isLoading: isMeLoading,
    isError: isMeError,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<Me>('/auth/me'),
  });

  // Total Orders
  const {
    data: orders,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
  } = useQuery({
    queryKey: ['dashboard', 'orders-count'],
    queryFn: () =>
      apiFetch<ListResponse>(
        '/orders?page=1&limit=1&search='
      ),
    refetchInterval: 30000,
  });

  // Total Customers
  const {
    data: customers,
    isLoading: isCustomersLoading,
    isError: isCustomersError,
  } = useQuery({
    queryKey: ['dashboard', 'customers-count'],
    queryFn: () =>
      apiFetch<ListResponse>(
        '/customers?page=1&limit=1'
      ),
    refetchInterval: 30000,
  });

  // Total Products
  const {
    data: products,
    isLoading: isProductsLoading,
    isError: isProductsError,
  } = useQuery({
    queryKey: ['dashboard', 'products-count'],
    queryFn: () =>
      apiFetch<ListResponse>(
        '/products?page=1&limit=1&search='
      ),
    refetchInterval: 30000,
  });

  // Total Tickets
  const {
    data: tickets,
    isLoading: isTicketsLoading,
    isError: isTicketsError,
  } = useQuery({
    queryKey: ['dashboard', 'tickets-count'],
    queryFn: () =>
      apiFetch<ListResponse>(
        '/tickets?page=1&limit=1&search=&status=&priority='
      ),
    refetchInterval: 30000,
  });

  const counts = {
    orders: orders?.pagination?.total ?? 0,
    customers: customers?.pagination?.total ?? 0,
    products: products?.pagination?.total ?? 0,
    tickets: tickets?.pagination?.total ?? 0,
  };

  const isLoading =
    isOrdersLoading ||
    isCustomersLoading ||
    isProductsLoading ||
    isTicketsLoading;

  const hasCountError =
    isOrdersError ||
    isCustomersError ||
    isProductsError ||
    isTicketsError;

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold text-gray-900">
        Dashboard
      </h1>

      <p className="mt-1 text-sm text-gray-500">
        {isMeLoading &&
          'Verifying backend connection…'}

        {isMeError &&
          'Could not reach the backend API. Is it running?'}

        {me &&
          `Backend session verified for ${me.email}.`}
      </p>

      {hasCountError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some dashboard statistics could not be loaded.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {dashboardCards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {card.label}
            </p>

            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {isLoading ? '…' : counts[card.key]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          System Overview
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Orders, customers, products and support tickets
          are connected to the live backend database.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">
              Orders
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {isLoading ? '…' : counts.orders}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Customers
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {isLoading ? '…' : counts.customers}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Products
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {isLoading ? '…' : counts.products}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Tickets
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {isLoading ? '…' : counts.tickets}
            </p>
          </div>
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Dashboard statistics automatically refresh every
          30 seconds.
        </p>
      </div>
    </AppLayout>
  );
}