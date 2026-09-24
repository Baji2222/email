import { FormEvent, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { AppLayout } from '@/components/layouts/AppLayout';
import { apiFetch } from '@/lib/apiClient';

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  company_name: string | null;
  email?: string | null;
};

type Product = {
  id: string;
  mac_id: string;
  serial_number: string | null;
  model: string | null;
  customer_id: string;
};

type Order = {
  id: string;
  order_number: string;
  reference_number: string | null;
  customer_id: string;
};

type Ticket = {
  id: string;
  ticket_number: string;
  customer_id: string;
  product_id: string | null;
  order_id: string | null;
  mac_id: string | null;
  serial_number: string | null;
  reference_number: string | null;
  location: string | null;
  office: string | null;
  issue_description: string;
  priority: string;
  status: string;
  assigned_engineer_id: string | null;
  resolution_remarks: string | null;
  created_at: string;
  updated_at: string;
  solved_at: string | null;
  closed_at: string | null;
  customers?: Customer;
  products?: Product;
  orders?: Order;
  admin_users?: {
    id: string;
    email: string;
    role: string;
  } | null;
};

type TicketHistory = {
  id: string;
  ticket_id: string;
  event_type: string;
  sender: string | null;
  recipient: string | null;
  message: string | null;
  old_status: string | null;
  new_status: string | null;
  created_by: string | null;
  created_at: string;
};

type TicketsResponse = {
  data: Ticket[];
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

type ProductsResponse = {
  data: Product[];
};

type OrdersResponse = {
  data: Order[];
};

type TicketDetailsResponse = {
  ticket: Ticket;
  history: TicketHistory[];
};

type TicketForm = {
  customer_id: string;
  product_id: string;
  order_id: string;
  mac_id: string;
  serial_number: string;
  reference_number: string;
  location: string;
  office: string;
  issue_description: string;
  priority: string;
};

const STATUSES = [
  'NEW',
  'IN PROGRESS',
  'WAITING FOR CUSTOMER',
  'TESTING',
  'SOLVED',
  'CLOSED',
];

const PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

const emptyForm: TicketForm = {
  customer_id: '',
  product_id: '',
  order_id: '',
  mac_id: '',
  serial_number: '',
  reference_number: '',
  location: '',
  office: '',
  issue_description: '',
  priority: 'MEDIUM',
};

function formatDate(value: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusClass(status: string) {
  switch (status) {
    case 'NEW':
      return 'bg-blue-100 text-blue-700';

    case 'IN PROGRESS':
      return 'bg-yellow-100 text-yellow-700';

    case 'WAITING FOR CUSTOMER':
      return 'bg-orange-100 text-orange-700';

    case 'TESTING':
      return 'bg-purple-100 text-purple-700';

    case 'SOLVED':
      return 'bg-green-100 text-green-700';

    case 'CLOSED':
      return 'bg-slate-200 text-slate-700';

    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function priorityClass(priority: string) {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';

    case 'HIGH':
      return 'bg-orange-100 text-orange-700';

    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-700';

    case 'LOW':
      return 'bg-green-100 text-green-700';

    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function Tickets() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] =
    useState<string | null>(null);

  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [error, setError] = useState('');

  const [resolutionText, setResolutionText] =
    useState('');

  const [noteText, setNoteText] = useState('');

  /*
   * ----------------------------------------------------
   * Tickets
   * ----------------------------------------------------
   */

  const ticketsQuery = useQuery({
    queryKey: [
      'tickets',
      page,
      search,
      statusFilter,
      priorityFilter,
    ],

    queryFn: () =>
      apiFetch<TicketsResponse>(
        `/tickets?page=${page}&limit=10&search=${encodeURIComponent(
          search
        )}&status=${encodeURIComponent(
          statusFilter
        )}&priority=${encodeURIComponent(priorityFilter)}`
      ),
  });

  /*
   * ----------------------------------------------------
   * Ticket details
   * ----------------------------------------------------
   */

  const ticketDetailsQuery = useQuery({
    queryKey: ['ticket', selectedTicketId],

    queryFn: () =>
      apiFetch<TicketDetailsResponse>(
        `/tickets/${selectedTicketId}`
      ),

    enabled: !!selectedTicketId,
  });

  /*
   * ----------------------------------------------------
   * Customers
   * ----------------------------------------------------
   */

  const customersQuery = useQuery({
    queryKey: ['customers-for-tickets'],

    queryFn: () =>
      apiFetch<CustomersResponse>(
        '/customers?page=1&limit=100'
      ),
  });

  /*
   * ----------------------------------------------------
   * Products
   * ----------------------------------------------------
   */

  const productsQuery = useQuery({
    queryKey: ['products-for-tickets'],

    queryFn: () =>
      apiFetch<ProductsResponse>(
        '/products?page=1&limit=100&search='
      ),
  });

  /*
   * ----------------------------------------------------
   * Orders
   * ----------------------------------------------------
   */

  const ordersQuery = useQuery({
    queryKey: ['orders-for-tickets'],

    queryFn: () =>
      apiFetch<OrdersResponse>(
        '/orders?page=1&limit=100&search='
      ),
  });

  /*
   * ----------------------------------------------------
   * Create ticket
   * ----------------------------------------------------
   */

  const createMutation = useMutation({
    mutationFn: async (payload: TicketForm) => {
      return apiFetch<Ticket>('/tickets', {
        method: 'POST',

        body: JSON.stringify({
          customer_id: payload.customer_id,
          product_id: payload.product_id || null,
          order_id: payload.order_id || null,
          mac_id: payload.mac_id || null,
          serial_number:
            payload.serial_number || null,
          reference_number:
            payload.reference_number || null,
          location: payload.location || null,
          office: payload.office || null,
          issue_description:
            payload.issue_description,
          priority: payload.priority,
        }),
      });
    },

    onSuccess: (ticket) => {
      queryClient.invalidateQueries({
        queryKey: ['tickets'],
      });

      setIsCreateOpen(false);
      setForm(emptyForm);
      setError('');

      setSelectedTicketId(ticket.id);
    },

    onError: (err: Error) => {
      setError(
        err.message || 'Failed to create ticket.'
      );
    },
  });

  /*
   * ----------------------------------------------------
   * Change status
   * ----------------------------------------------------
   */

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      return apiFetch<Ticket>(
        `/tickets/${id}/status`,
        {
          method: 'POST',

          body: JSON.stringify({
            status,
          }),
        }
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tickets'],
      });

      queryClient.invalidateQueries({
        queryKey: ['ticket', selectedTicketId],
      });
    },
  });

  /*
   * ----------------------------------------------------
   * Resolve
   * ----------------------------------------------------
   */

  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      resolution,
    }: {
      id: string;
      resolution: string;
    }) => {
      return apiFetch<TicketDetailsResponse>(
        `/tickets/${id}/resolve`,
        {
          method: 'POST',

          body: JSON.stringify({
            resolution_remarks: resolution,
          }),
        }
      );
    },

    onSuccess: () => {
      setResolutionText('');

      queryClient.invalidateQueries({
        queryKey: ['tickets'],
      });

      queryClient.invalidateQueries({
        queryKey: ['ticket', selectedTicketId],
      });
    },
  });

  /*
   * ----------------------------------------------------
   * Close ticket
   * ----------------------------------------------------
   */

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<Ticket>(
        `/tickets/${id}/close`,
        {
          method: 'POST',
        }
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tickets'],
      });

      queryClient.invalidateQueries({
        queryKey: ['ticket', selectedTicketId],
      });
    },
  });

  /*
   * ----------------------------------------------------
   * Internal note
   * ----------------------------------------------------
   */

  const noteMutation = useMutation({
    mutationFn: async ({
      id,
      message,
    }: {
      id: string;
      message: string;
    }) => {
      return apiFetch(
        `/tickets/${id}/note`,
        {
          method: 'POST',

          body: JSON.stringify({
            message,
          }),
        }
      );
    },

    onSuccess: () => {
      setNoteText('');

      queryClient.invalidateQueries({
        queryKey: ['ticket', selectedTicketId],
      });
    },
  });

  /*
   * ----------------------------------------------------
   * Form submit
   * ----------------------------------------------------
   */

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.customer_id) {
      setError('Please select a customer.');
      return;
    }

    if (!form.issue_description.trim()) {
      setError('Issue description is required.');
      return;
    }

    createMutation.mutate(form);
  }

  /*
   * ----------------------------------------------------
   * Product selection
   * ----------------------------------------------------
   */

  function handleProductChange(productId: string) {
    const product = products.find(
      (item) => item.id === productId
    );

    if (!product) {
      setForm({
        ...form,
        product_id: '',
        mac_id: '',
        serial_number: '',
      });

      return;
    }

    setForm({
      ...form,
      product_id: product.id,
      customer_id: product.customer_id,
      mac_id: product.mac_id,
      serial_number:
        product.serial_number || '',
    });
  }

  const tickets = ticketsQuery.data?.data || [];

  const customers =
    customersQuery.data?.data || [];

  const products =
    productsQuery.data?.data || [];

  const orders =
    ordersQuery.data?.data || [];

  const selectedCustomerOrders =
    orders.filter(
      (order) =>
        order.customer_id === form.customer_id
    );

  const pagination =
    ticketsQuery.data?.pagination;

  const selectedTicket =
    ticketDetailsQuery.data?.ticket;

  const ticketHistory =
    ticketDetailsQuery.data?.history || [];

  return (
    <AppLayout>
      <div className="p-6">

        {/* ------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------ */}

        <div className="mb-6 flex items-center justify-between">

          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Tickets
            </h1>

            <p className="mt-1 text-slate-500">
              Manage customer issues, service requests
              and resolutions.
            </p>
          </div>

          <button
            onClick={() => {
              setForm(emptyForm);
              setError('');
              setIsCreateOpen(true);
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Create Ticket
          </button>

        </div>

        {/* ------------------------------------------------ */}
        {/* FILTERS */}
        {/* ------------------------------------------------ */}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ticket, MAC, reference, issue..."
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">
              All Statuses
            </option>

            {STATUSES.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">
              All Priorities
            </option>

            {PRIORITIES.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {priority}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setPriorityFilter('');
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium hover:bg-slate-50"
          >
            Clear Filters
          </button>

        </div>

        {/* ------------------------------------------------ */}
        {/* TABLE */}
        {/* ------------------------------------------------ */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {ticketsQuery.isLoading ? (

            <div className="p-10 text-center text-slate-500">
              Loading tickets...
            </div>

          ) : ticketsQuery.isError ? (

            <div className="p-10 text-center text-red-600">
              {(ticketsQuery.error as Error).message}
            </div>

          ) : tickets.length === 0 ? (

            <div className="p-10 text-center text-slate-500">
              No tickets found.
            </div>

          ) : (

            <>
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1200px]">

                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-sm text-slate-600">

                      <th className="px-5 py-4">
                        Ticket
                      </th>

                      <th className="px-5 py-4">
                        Customer
                      </th>

                      <th className="px-5 py-4">
                        MAC ID
                      </th>

                      <th className="px-5 py-4">
                        Issue
                      </th>

                      <th className="px-5 py-4">
                        Priority
                      </th>

                      <th className="px-5 py-4">
                        Status
                      </th>

                      <th className="px-5 py-4">
                        Created
                      </th>

                      <th className="px-5 py-4">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {tickets.map((ticket) => (

                      <tr
                        key={ticket.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4">

                          <div className="font-mono font-semibold text-blue-600">
                            {ticket.ticket_number}
                          </div>

                          {ticket.reference_number && (
                            <div className="text-xs text-slate-500">
                              Ref: {ticket.reference_number}
                            </div>
                          )}

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-medium">
                            {ticket.customers?.customer_name ||
                              '-'}
                          </div>

                          <div className="text-xs text-slate-500">
                            {ticket.customers?.customer_code ||
                              ''}
                          </div>

                        </td>

                        <td className="px-5 py-4 font-mono text-sm">
                          {ticket.mac_id || '-'}
                        </td>

                        <td className="max-w-[300px] px-5 py-4">
                          <div className="truncate">
                            {ticket.issue_description}
                          </div>
                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(ticket.created_at)}
                        </td>

                        <td className="px-5 py-4">

                          <button
                            onClick={() =>
                              setSelectedTicketId(
                                ticket.id
                              )
                            }
                            className="font-semibold text-blue-600 hover:text-blue-800"
                          >
                            View
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

              {/* Pagination */}

              <div className="flex items-center justify-between border-t p-5">

                <span className="text-sm text-slate-500">
                  {pagination?.total || 0}{' '}
                  {pagination?.total === 1
                    ? 'ticket'
                    : 'tickets'}
                </span>

                <div className="flex items-center gap-3">

                  <button
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((value) => value - 1)
                    }
                    className="rounded-lg border px-4 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-slate-600">
                    Page {pagination?.page || 1} of{' '}
                    {pagination?.totalPages || 1}
                  </span>

                  <button
                    disabled={
                      page >=
                      (pagination?.totalPages || 1)
                    }
                    onClick={() =>
                      setPage((value) => value + 1)
                    }
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

      {/* ================================================= */}
      {/* CREATE TICKET MODAL */}
      {/* ================================================= */}

      {isCreateOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b p-6">

              <div>
                <h2 className="text-2xl font-semibold">
                  Create Ticket
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create a service or support ticket.
                </p>
              </div>

              <button
                onClick={() =>
                  setIsCreateOpen(false)
                }
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreate}
              className="space-y-5 p-6"
            >

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                {/* Customer */}

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
                        product_id: '',
                        order_id: '',
                        mac_id: '',
                        serial_number: '',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    required
                  >

                    <option value="">
                      Select customer
                    </option>

                    {customers.map((customer) => (

                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.customer_code} -{' '}
                        {customer.customer_name}
                      </option>

                    ))}

                  </select>

                </div>

                {/* Product */}

                <div>

                  <label className="mb-2 block font-medium">
                    Product / Network Switch
                  </label>

                  <select
                    value={form.product_id}
                    onChange={(e) =>
                      handleProductChange(
                        e.target.value
                      )
                    }
                    disabled={!form.customer_id}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
                  >

                    <option value="">
                      Select product
                    </option>

                    {products
                      .filter(
                        (product) =>
                          product.customer_id ===
                          form.customer_id
                      )
                      .map((product) => (

                        <option
                          key={product.id}
                          value={product.id}
                        >
                          {product.mac_id}
                          {product.model
                            ? ` - ${product.model}`
                            : ''}
                        </option>

                      ))}

                  </select>

                </div>

                {/* Order */}

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
                    disabled={!form.customer_id}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
                  >

                    <option value="">
                      No order
                    </option>

                    {selectedCustomerOrders.map(
                      (order) => (

                        <option
                          key={order.id}
                          value={order.id}
                        >
                          {order.order_number}
                          {order.reference_number
                            ? ` - ${order.reference_number}`
                            : ''}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* Priority */}

                <div>

                  <label className="mb-2 block font-medium">
                    Priority
                  </label>

                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priority: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >

                    {PRIORITIES.map(
                      (priority) => (

                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* MAC */}

                <div>

                  <label className="mb-2 block font-medium">
                    MAC ID
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
                  />

                </div>

                {/* Serial */}

                <div>

                  <label className="mb-2 block font-medium">
                    Serial Number
                  </label>

                  <input
                    value={form.serial_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        serial_number:
                          e.target.value,
                      })
                    }
                    placeholder="Serial number"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />

                </div>

                {/* Reference */}

                <div>

                  <label className="mb-2 block font-medium">
                    Reference Number
                  </label>

                  <input
                    value={form.reference_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reference_number:
                          e.target.value,
                      })
                    }
                    placeholder="Customer reference"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />

                </div>

                {/* Location */}

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
                    placeholder="Installation / site location"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />

                </div>

                {/* Office */}

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

              </div>

              {/* Issue */}

              <div>

                <label className="mb-2 block font-medium">
                  Issue Description *
                </label>

                <textarea
                  value={form.issue_description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      issue_description:
                        e.target.value,
                    })
                  }
                  rows={5}
                  placeholder="Describe the problem reported by the customer..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  required
                />

              </div>

              <div className="flex justify-end gap-3 border-t pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setIsCreateOpen(false)
                  }
                  className="rounded-xl border px-5 py-3 font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? 'Creating...'
                    : 'Create Ticket'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ================================================= */}
      {/* TICKET DETAILS MODAL */}
      {/* ================================================= */}

      {selectedTicketId && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl">

            {ticketDetailsQuery.isLoading ? (

              <div className="p-10 text-center text-slate-500">
                Loading ticket...
              </div>

            ) : ticketDetailsQuery.isError ? (

              <div className="p-10 text-center text-red-600">
                {(ticketDetailsQuery.error as Error).message}
              </div>

            ) : selectedTicket ? (

              <>

                {/* Header */}

                <div className="flex items-start justify-between border-b p-6">

                  <div>

                    <div className="flex items-center gap-3">

                      <h2 className="font-mono text-2xl font-semibold">
                        {selectedTicket.ticket_number}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          selectedTicket.status
                        )}`}
                      >
                        {selectedTicket.status}
                      </span>

                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Created{' '}
                      {formatDate(
                        selectedTicket.created_at
                      )}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setSelectedTicketId(null)
                    }
                    className="text-2xl text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>

                </div>

                <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">

                  {/* ------------------------------------- */}
                  {/* LEFT - DETAILS */}
                  {/* ------------------------------------- */}

                  <div className="space-y-5 lg:col-span-2">

                    <div className="rounded-2xl border p-5">

                      <h3 className="mb-4 text-lg font-semibold">
                        Ticket Information
                      </h3>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                        <div>
                          <div className="text-sm text-slate-500">
                            Customer
                          </div>

                          <div className="font-medium">
                            {selectedTicket.customers
                              ?.customer_name || '-'}
                          </div>

                          <div className="text-sm text-slate-500">
                            {selectedTicket.customers
                              ?.customer_code || ''}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Email
                          </div>

                          <div>
                            {selectedTicket.customers
                              ?.email || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            MAC ID
                          </div>

                          <div className="font-mono">
                            {selectedTicket.mac_id || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Serial Number
                          </div>

                          <div>
                            {selectedTicket.serial_number ||
                              '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Order
                          </div>

                          <div>
                            {selectedTicket.orders
                              ?.order_number || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Reference
                          </div>

                          <div>
                            {selectedTicket.reference_number ||
                              '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Location
                          </div>

                          <div>
                            {selectedTicket.location || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Office
                          </div>

                          <div>
                            {selectedTicket.office || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Priority
                          </div>

                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(
                              selectedTicket.priority
                            )}`}
                          >
                            {selectedTicket.priority}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">
                            Assigned Engineer
                          </div>

                          <div>
                            {selectedTicket.admin_users
                              ?.email || 'Not assigned'}
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Issue */}

                    <div className="rounded-2xl border p-5">

                      <h3 className="mb-3 text-lg font-semibold">
                        Issue Description
                      </h3>

                      <div className="whitespace-pre-wrap text-slate-700">
                        {selectedTicket.issue_description}
                      </div>

                    </div>

                    {/* Resolution */}

                    {selectedTicket.resolution_remarks && (

                      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">

                        <h3 className="mb-3 text-lg font-semibold text-green-800">
                          Resolution
                        </h3>

                        <div className="whitespace-pre-wrap text-green-900">
                          {selectedTicket.resolution_remarks}
                        </div>

                        {selectedTicket.solved_at && (
                          <div className="mt-3 text-sm text-green-700">
                            Solved:{' '}
                            {formatDate(
                              selectedTicket.solved_at
                            )}
                          </div>
                        )}

                      </div>

                    )}

                    {/* History */}

                    <div className="rounded-2xl border p-5">

                      <h3 className="mb-5 text-lg font-semibold">
                        Ticket History
                      </h3>

                      {ticketHistory.length === 0 ? (

                        <div className="text-sm text-slate-500">
                          No history available.
                        </div>

                      ) : (

                        <div className="space-y-4">

                          {ticketHistory.map(
                            (item) => (

                              <div
                                key={item.id}
                                className="border-l-2 border-slate-200 pl-4"
                              >

                                <div className="flex items-center justify-between">

                                  <span className="font-semibold text-slate-800">
                                    {item.event_type}
                                  </span>

                                  <span className="text-xs text-slate-500">
                                    {formatDate(
                                      item.created_at
                                    )}
                                  </span>

                                </div>

                                {item.message && (
                                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {item.message}
                                  </div>
                                )}

                                {item.old_status &&
                                  item.new_status && (
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.old_status} →{' '}
                                      {item.new_status}
                                    </div>
                                  )}

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  </div>

                  {/* ------------------------------------- */}
                  {/* RIGHT - ACTIONS */}
                  {/* ------------------------------------- */}

                  <div className="space-y-5">

                    {/* Status */}

                    <div className="rounded-2xl border p-5">

                      <h3 className="mb-4 font-semibold">
                        Change Status
                      </h3>

                      <select
                        value={selectedTicket.status}
                        onChange={(e) =>
                          statusMutation.mutate({
                            id: selectedTicket.id,
                            status: e.target.value,
                          })
                        }
                        disabled={
                          statusMutation.isPending ||
                          selectedTicket.status ===
                            'CLOSED'
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      >

                        {STATUSES.map((status) => (

                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>

                        ))}

                      </select>

                    </div>

                    {/* Resolve */}

                    {selectedTicket.status !==
                      'SOLVED' &&
                      selectedTicket.status !==
                        'CLOSED' && (

                        <div className="rounded-2xl border p-5">

                          <h3 className="mb-4 font-semibold">
                            Resolve Ticket
                          </h3>

                          <textarea
                            value={resolutionText}
                            onChange={(e) =>
                              setResolutionText(
                                e.target.value
                              )
                            }
                            rows={5}
                            placeholder="Enter resolution details..."
                            className="w-full rounded-xl border border-slate-300 px-4 py-3"
                          />

                          <button
                            disabled={
                              !resolutionText.trim() ||
                              resolveMutation.isPending
                            }
                            onClick={() =>
                              resolveMutation.mutate({
                                id: selectedTicket.id,
                                resolution:
                                  resolutionText.trim(),
                              })
                            }
                            className="mt-3 w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {resolveMutation.isPending
                              ? 'Resolving...'
                              : 'Mark as Solved'}
                          </button>

                        </div>

                      )}

                    {/* Close */}

                    {selectedTicket.status ===
                      'SOLVED' && (

                        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">

                          <h3 className="mb-2 font-semibold text-green-800">
                            Resolution Complete
                          </h3>

                          <p className="mb-4 text-sm text-green-700">
                            This ticket is solved and can
                            now be closed.
                          </p>

                          <button
                            disabled={
                              closeMutation.isPending
                            }
                            onClick={() =>
                              closeMutation.mutate(
                                selectedTicket.id
                              )
                            }
                            className="w-full rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                          >
                            {closeMutation.isPending
                              ? 'Closing...'
                              : 'Close Ticket'}
                          </button>

                        </div>

                      )}

                    {/* Internal note */}

                    {selectedTicket.status !==
                      'CLOSED' && (

                        <div className="rounded-2xl border p-5">

                          <h3 className="mb-4 font-semibold">
                            Internal Note
                          </h3>

                          <textarea
                            value={noteText}
                            onChange={(e) =>
                              setNoteText(
                                e.target.value
                              )
                            }
                            rows={4}
                            placeholder="Add an internal note..."
                            className="w-full rounded-xl border border-slate-300 px-4 py-3"
                          />

                          <button
                            disabled={
                              !noteText.trim() ||
                              noteMutation.isPending
                            }
                            onClick={() =>
                              noteMutation.mutate({
                                id: selectedTicket.id,
                                message:
                                  noteText.trim(),
                              })
                            }
                            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50 disabled:opacity-50"
                          >
                            {noteMutation.isPending
                              ? 'Adding...'
                              : 'Add Internal Note'}
                          </button>

                        </div>

                      )}

                  </div>

                </div>

              </>

            ) : null}

          </div>

        </div>

      )}

    </AppLayout>
  );
}