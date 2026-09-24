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
  reference_number: string | null;
  customer_id: string;
};

type Product = {
  id: string;
  mac_id: string;
  serial_number: string | null;
  model: string | null;
  customer_id: string;
  order_id: string | null;
  installation_location: string | null;
  office: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  status: string;
  remarks: string | null;
  customers?: Customer;
  orders?: Order;
};

type ProductsResponse = {
  data: Product[];
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

type OrdersResponse = {
  data: Order[];
};

type ProductForm = {
  mac_id: string;
  serial_number: string;
  model: string;
  customer_id: string;
  order_id: string;
  installation_location: string;
  office: string;
  warranty_start: string;
  warranty_end: string;
  status: string;
  remarks: string;
};

const emptyForm: ProductForm = {
  mac_id: '',
  serial_number: '',
  model: '',
  customer_id: '',
  order_id: '',
  installation_location: '',
  office: '',
  warranty_start: '',
  warranty_end: '',
  status: 'ACTIVE',
  remarks: '',
};

const PRODUCT_STATUSES = [
  'ACTIVE',
  'UNDER SERVICE',
  'REPLACED',
  'RETURNED',
  'RETIRED',
];

function normalizeMacPreview(value: string): string {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();

  if (hex.length !== 12) {
    return value.toUpperCase();
  }

  return hex.match(/.{2}/g)?.join(':') || value.toUpperCase();
}

export default function Products() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState('');

  const productsQuery = useQuery({
    queryKey: ['products', page, search],
    queryFn: () =>
      apiFetch<ProductsResponse>(
        `/products?page=${page}&limit=10&search=${encodeURIComponent(search)}`
      ),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-products'],
    queryFn: () =>
      apiFetch<CustomersResponse>('/customers?page=1&limit=100'),
  });

  const ordersQuery = useQuery({
    queryKey: ['orders-for-products'],
    queryFn: () =>
      apiFetch<OrdersResponse>('/orders?page=1&limit=100&search='),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProductForm) => {
      const data = {
        ...payload,
        mac_id: normalizeMacPreview(payload.mac_id),
        order_id: payload.order_id || null,
        warranty_start: payload.warranty_start || null,
        warranty_end: payload.warranty_end || null,
      };

      if (editingProduct) {
        return apiFetch<Product>(`/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }

      return apiFetch<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },

    onError: (err: Error) => {
      setError(err.message || 'Failed to save product.');
    },
  });

  function openAddModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError('');
    setIsModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setError('');

    setForm({
      mac_id: product.mac_id || '',
      serial_number: product.serial_number || '',
      model: product.model || '',
      customer_id: product.customer_id || '',
      order_id: product.order_id || '',
      installation_location: product.installation_location || '',
      office: product.office || '',
      warranty_start: product.warranty_start || '',
      warranty_end: product.warranty_end || '',
      status: product.status || 'ACTIVE',
      remarks: product.remarks || '',
    });

    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.mac_id.trim()) {
      setError('MAC ID is required.');
      return;
    }

    const mac = form.mac_id.replace(/[^a-fA-F0-9]/g, '');

    if (mac.length !== 12) {
      setError(
        'MAC ID must contain exactly 12 hexadecimal characters.'
      );
      return;
    }

    if (!form.customer_id) {
      setError('Please select a customer.');
      return;
    }

    saveMutation.mutate(form);
  }

  const products = productsQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];
  const orders = ordersQuery.data?.data ?? [];
  const pagination = productsQuery.data?.pagination;

  const selectedCustomerOrders = orders.filter(
    (order) => order.customer_id === form.customer_id
  );

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Products
            </h1>

            <p className="mt-1 text-slate-500">
              Manage network switches and installed products.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Add Product
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
              placeholder="Search MAC ID, serial number, model, location or office..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          {productsQuery.isLoading ? (
            <div className="p-8 text-center text-slate-500">
              Loading products...
            </div>
          ) : productsQuery.isError ? (
            <div className="p-8 text-center text-red-600">
              {(productsQuery.error as Error).message}
            </div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No products found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-sm text-slate-600">
                      <th className="px-5 py-4">MAC ID</th>
                      <th className="px-5 py-4">SERIAL</th>
                      <th className="px-5 py-4">MODEL</th>
                      <th className="px-5 py-4">CUSTOMER</th>
                      <th className="px-5 py-4">ORDER</th>
                      <th className="px-5 py-4">LOCATION</th>
                      <th className="px-5 py-4">STATUS</th>
                      <th className="px-5 py-4">ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-mono font-semibold">
                          {product.mac_id}
                        </td>

                        <td className="px-5 py-4">
                          {product.serial_number || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {product.model || '-'}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {product.customers?.customer_name || '-'}
                          </div>

                          <div className="text-sm text-slate-500">
                            {product.customers?.customer_code || ''}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {product.orders?.order_number || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {product.installation_location || '-'}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                            {product.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => openEditModal(product)}
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
                  {pagination?.total === 1 ? 'product' : 'products'}
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
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-semibold">
                  {editingProduct ? 'Edit Product' : 'Add Product'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Register a network switch and link it to a customer.
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

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-medium">
                    MAC ID *
                  </label>

                  <input
                    value={form.mac_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mac_id: e.target.value,
                      })
                    }
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono"
                    required
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    12 hexadecimal characters. Colons or hyphens are
                    accepted.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Serial Number
                  </label>

                  <input
                    value={form.serial_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        serial_number: e.target.value,
                      })
                    }
                    placeholder="Serial number"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Model
                  </label>

                  <input
                    value={form.model}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        model: e.target.value,
                      })
                    }
                    placeholder="Network switch model"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    {PRODUCT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

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
                        order_id: '',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    required
                  >
                    <option value="">Select customer</option>

                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_code} -{' '}
                        {customer.customer_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Order
                  </label>

                  <select
                    value={form.order_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        order_id: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    disabled={!form.customer_id}
                  >
                    <option value="">No order / select later</option>

                    {selectedCustomerOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number}
                        {order.reference_number
                          ? ` - ${order.reference_number}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Installation Location
                  </label>

                  <input
                    value={form.installation_location}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        installation_location: e.target.value,
                      })
                    }
                    placeholder="Installation location"
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
                    Warranty Start
                  </label>

                  <input
                    type="date"
                    value={form.warranty_start}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        warranty_start: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Warranty End
                  </label>

                  <input
                    type="date"
                    value={form.warranty_end}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        warranty_end: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>
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
                  placeholder="Additional product information"
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
                    : editingProduct
                      ? 'Update Product'
                      : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}