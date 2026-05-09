/**
 * PostsTable component — admin posts list with TanStack Table.
 *
 * Design §6 — TanStack Table: list with offset pagination, sortable columns,
 * status filter.
 *
 * Uses @tanstack/react-query for data fetching and @tanstack/react-table
 * for table state management (sorting, column visibility).
 */

import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { type Post, type PostStatus, type PostsListResponse, postsClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

const PAGE_SIZE = 10;

const columns: ColumnDef<Post>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue<PostStatus>();
      const colors: Record<PostStatus, string> = {
        draft: 'bg-yellow-100 text-yellow-800',
        published: 'bg-green-100 text-green-800',
        archived: 'bg-gray-100 text-gray-800',
      };
      return (
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
  },
];

export function PostsTable() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');

  const params: Record<string, unknown> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data, isLoading, isError } = useQuery<PostsListResponse>({
    queryKey: queryKeys.posts.list(params),
    queryFn: async () => {
      const res = await postsClient.list({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      return res.json() as Promise<PostsListResponse>;
    },
  });

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
    return <p className="p-4 text-red-600">Failed to load posts.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status
        </label>
        <select
          id="status-filter"
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PostStatus | '');
            setPage(0);
          }}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-gray-50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2 text-left font-medium text-gray-700"
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
                No posts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{data ? `${data.total} total posts` : ''}</span>
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
