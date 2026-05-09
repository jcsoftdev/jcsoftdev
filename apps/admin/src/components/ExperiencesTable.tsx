/**
 * ExperiencesTable component — admin experiences list with TanStack Table.
 *
 * Design §10 — mirrors ProjectsTable pattern:
 * TanStack Table with offset pagination, columns: company, role, displayOrder,
 * startedAt, endedAt. Hard-delete button per row.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { type Experience, type ExperiencesListResponse, experiencesClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

const PAGE_SIZE = 10;

export function ExperiencesTable() {
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  const params: Record<string, unknown> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, isError } = useQuery<ExperiencesListResponse>({
    queryKey: queryKeys.experiences.list(params),
    queryFn: async () => {
      const res = await experiencesClient.list({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      return res.json() as Promise<ExperiencesListResponse>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => experiencesClient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.experiences.all });
    },
  });

  const columns: ColumnDef<Experience>[] = [
    {
      accessorKey: 'company',
      header: 'Company',
    },
    {
      accessorKey: 'role',
      header: 'Role',
    },
    {
      accessorKey: 'displayOrder',
      header: 'Display Order',
    },
    {
      accessorKey: 'startedAt',
      header: 'Started At',
      cell: ({ getValue }) => {
        const val = getValue<string | null>();
        return val ? new Date(val).toLocaleDateString() : '—';
      },
    },
    {
      accessorKey: 'endedAt',
      header: 'Ended At',
      cell: ({ getValue }) => {
        const val = getValue<string | null>();
        return val ? new Date(val).toLocaleDateString() : 'Present';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          type="button"
          aria-label="Delete"
          onClick={() => deleteMutation.mutate(row.original.id)}
          disabled={deleteMutation.isPending}
          className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Delete
        </button>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / PAGE_SIZE) : -1,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  if (isLoading) {
    return <p className="p-4 text-gray-500">Loading...</p>;
  }

  if (isError) {
    return <p className="p-4 text-red-600">Failed to load experiences.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-gray-50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer px-4 py-2 text-left font-medium text-gray-700"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                No experiences found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {data ? `${data.total} total experiences` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrevPage}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNextPage}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
