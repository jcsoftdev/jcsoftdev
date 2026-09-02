/**
 * ProjectsTable component — admin projects list with TanStack Table.
 *
 * Design §10 — mirrors PostsTable pattern:
 * TanStack Table with offset pagination, sortable columns (name, featuredOrder, startedAt),
 * and a hard-delete button per row.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { type Project, type ProjectsListResponse, projectsClient } from '../lib/api.js';
import { assertOkJson } from '../lib/assert-ok.js';
import { queryKeys } from '../lib/query.js';

const PAGE_SIZE = 10;

export function ProjectsTable() {
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  const params: Record<string, unknown> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, isError } = useQuery<ProjectsListResponse>({
    queryKey: queryKeys.projects.list(params),
    queryFn: async () => {
      const res = await projectsClient.list({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      return assertOkJson<ProjectsListResponse>(res, 'projects');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await projectsClient.delete(id);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Request failed');
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
    },
    {
      accessorKey: 'featuredOrder',
      header: 'Featured Order',
      cell: ({ getValue }) => {
        const val = getValue<number | null>();
        return val ?? '—';
      },
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
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Link
            to="/projects/$id/edit"
            params={{ id: row.original.id }}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
          >
            Edit
          </Link>
          <button
            type="button"
            aria-label="Delete"
            onClick={() => {
              if (window.confirm(`Delete project "${row.original.name}"? This cannot be undone.`)) {
                deleteMutation.mutate(row.original.id);
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
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
    return <p className="p-4 text-red-600">Failed to load projects.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {deleteMutation.error && (
        <p role="alert" className="text-sm text-red-600">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : 'Failed to delete project'}
        </p>
      )}

      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-gray-50">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-2 text-left font-medium text-gray-700">
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer font-medium"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </button>
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
                No projects found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{data ? `${data.total} total projects` : ''}</span>
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
