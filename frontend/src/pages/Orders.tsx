import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layouts/AppLayout';
import { apiFetch } from '@/lib/apiClient';

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  company_name: string | null;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  reference_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  location: string | null;
  office: string | null;
  order_status: string;
  remarks: string | null;
  customers?: Customer;
};

type OrdersResponse = {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type CustomersResponse = {
  data: Customer[];
};

type OrderForm = {
  customer_id: string;
  order_date: string;
  reference_number: string;
  billing_address: string;
  shipping_address: string;
  location: string;
  office: string;
  order_status: string;
  remarks: string;
};

const emptyForm: OrderForm = {
  customer_id: '',
  order_date: new Date().toISOString().slice(0, 10),
  reference_number: '',
  billing_address: '',
  shipping_address: '',
  location: '',
  office: '',
  order_status: 'ORDER RECEIVED',
  remarks: '',
};

export default function Orders() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [error, setError] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['orders', page, search],
    queryFn: () =>
      apiFetch<OrdersResponse>(
        `/orders?page=${page}&limit=10&search=${encodeURIComponent(search)}`
      ),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-orders'],
    queryFn: () =>
      apiFetch<CustomersResponse>('/customers?page=1&limit=100'),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: OrderForm) => {
      if (editingOrder) {
        return apiFetch<Order>(`/orders/${editingOrder.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }

      return apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      closeModal();
    },

    onError: (err: Error) => {
      setError(err.message || 'Failed to save order.');
    },
  });

  function openAddModal() {
    setEditingOrder(null);
    setForm(emptyForm);
    setError('');
    setIsModalOpen(true);
  }

  function openEditModal(order: Order) {
    setEditingOrder(order);
    setError('');

    setForm({
      customer_id: order.customer_id || '',
      order_date: order.order_date || '',
      reference_number: order.reference_number || '',
      billing_address: order.billing_address || '',
      shipping_address: order.shipping_address || '',
      location: order.location || '',
      office: order.office || '',
      order_status: order.order_status || 'ORDER RECEIVED',
      remarks: order.remarks || '',
    });

    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingOrder(null);
    setForm(emptyForm);
    setError('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.customer_id) {
      setError('Please select a customer.');
      return;
    }

    saveMutation.mutate(form);
  }

  const orders = ordersQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.pagination;

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Orders
            </h1>
            <p className="mt-1 text-slate-500">
              Manage customer orders and order information.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Add Order
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by order number, reference, location or office..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          {ordersQuery.isLoading ? (
            <div className="p-8 text-center text-slate-500">
              Loading orders...
            </div>
          ) : ordersQuery.isError ? (
            <div className="p-8 text-center text-red-600">
              {(ordersQuery.error as Error).message}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No orders found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-sm text-slate-600">
                      <th className="px-5 py-4">ORDER</th>
                      <th className="px-5 py-4">CUSTOMER</th>
                      <th className="px-5 py-4">DATE</th>
                      <th className="px-5 py-4">REFERENCE</th>
                      <th className="px-5 py-4">LOCATION</th>
                      <th className="px-5 py-4">OFFICE</th>
                      <th className="px-5 py-4">STATUS</th>
                      <th className="px-5 py-4">ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold">
                          {order.order_number}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {order.customers?.customer_name || '-'}
                          </div>
                          <div className="text-sm text-slate-500">
                            {order.customers?.customer_code || ''}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {order.order_date || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {order.reference_number || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {order.location || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {order.office || '-'}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                            {order.order_status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => openEditModal(order)}
                            className="font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t p-5">
                <span className="text-sm text-slate-500">
                  {pagination?.total ?? 0}{' '}
                  {pagination?.total === 1 ? 'order' : 'orders'}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border px-4 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-slate-600">
                    Page {pagination?.page ?? 1} of{' '}
                    {pagination?.totalPages ?? 1}
                  </span>

                  <button
                    disabled={
                      page >= (pagination?.totalPages ?? 1)
                    }
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border px-4 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-semibold">
                  {editingOrder ? 'Edit Order' : 'Add Order'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the order and customer details.
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block font-medium">
                  Customer *
                </label>

                <select
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customer_id: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  required
                >
                  <option value="">Select customer</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_code} - {customer.customer_name}
                      {customer.company_name
                        ? ` (${customer.company_name})`
                        : ''}
                    </option>
                  ))}
                </select>

                {customers.length === 0 && (
                  <p className="mt-2 text-sm text-red-500">
                    No customers found. Create a customer first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-medium">
                    Order Date *
                  </label>

                  <input
                    type="date"
                    value={form.order_date}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        order_date: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Reference Number
                  </label>

                  <input
                    value={form.reference_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reference_number: e.target.value,
                      })
                    }
                    placeholder="PO / Reference number"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Location
                  </label>

                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        location: e.target.value,
                      })
                    }
                    placeholder="Installation / delivery location"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Office
                  </label>

                  <input
                    value={form.office}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        office: e.target.value,
                      })
                    }
                    placeholder="Office"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Order Status
                  </label>

                  <select
                    value={form.order_status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        order_status: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                   <option value="ORDER RECEIVED">ORDER RECEIVED</option>
<option value="PROCESSING">PROCESSING</option>
<option value="SHIPPED">SHIPPED</option>
<option value="DELIVERED">DELIVERED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Billing Address
                </label>

                <textarea
                  value={form.billing_address}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      billing_address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Shipping Address
                </label>

                <textarea
                  value={form.shipping_address}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      shipping_address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Remarks
                </label>

                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      remarks: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border px-5 py-3 font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? 'Saving...'
                    : editingOrder
                      ? 'Update Order'
                      : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}