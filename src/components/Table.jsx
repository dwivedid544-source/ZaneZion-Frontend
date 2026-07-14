import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { Eye, Edit2, Trash2, PackageOpen } from 'lucide-react';
import BootstrapPagination from './Common/Pagination';

const Table = ({ columns, data, actions, onView, onEdit, onDelete, canEdit = true, canDelete = true, customAction, pagination, onPageChange, itemsPerPage = 10 }) => {
  const [internalPage, setInternalPage] = useState(1);

  // If backend pagination is provided, use that; otherwise paginate client-side
  const isBackendPaginated = !!pagination;
  const currentPage = isBackendPaginated ? (pagination.page || 1) : internalPage;
  const totalItems = isBackendPaginated ? (pagination.total || pagination.totalItems || data.length) : data.length;
  const perPage = isBackendPaginated ? (pagination.limit || itemsPerPage) : itemsPerPage;
  const totalPages = isBackendPaginated ? (pagination.totalPages || 1) : Math.ceil(data.length / perPage);

  // Client-side: slice data for current page
  const displayData = isBackendPaginated ? data : data.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handlePage = (pageNumber) => {
    if (isBackendPaginated && onPageChange) {
      onPageChange(pageNumber);
    } else {
      setInternalPage(pageNumber);
    }
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-border flex items-center justify-center">
        <PackageOpen size={28} className="text-muted opacity-40" />
      </div>
      <div>
        <p className="text-sm font-bold text-secondary">No records found</p>
        <p className="text-[11px] text-muted mt-1">Try adjusting your search or go back to previous page.</p>
      </div>
    </div>
  );

  return (
    <div className="w-full overflow-hidden">
      {data.length === 0 ? renderEmptyState() : (
        <>
      {/* ── Desktop Table ─────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-4 px-4 text-[10px] font-black text-muted/60 uppercase tracking-[0.15em] whitespace-nowrap w-8">#</th>
              {columns.map((col, idx) => (
                <th key={idx} className="text-left py-4 px-4 text-[10px] font-black text-muted uppercase tracking-[0.15em] whitespace-nowrap">
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="text-right py-4 px-4 text-[10px] font-black text-muted uppercase tracking-[0.15em] whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {displayData.map((row, rowIdx) => (
              <tr
                key={row.id || row.requestId || rowIdx}
                className="transition-all duration-150 group hover:bg-white/[0.025]"
              >
                {/* Row number */}
                <td className="py-4 px-4 text-xs text-muted/40 font-bold tabular-nums">
                  {((currentPage - 1) * perPage + rowIdx + 1).toString().padStart(2, '0')}
                </td>

                {columns.map((col, colIdx) => {
                  let rawVal = row[col.accessor];
                  if (typeof rawVal === 'object' && rawVal !== null && !React.isValidElement(rawVal)) {
                    rawVal = rawVal.name || rawVal.title || JSON.stringify(rawVal);
                  }
                  return (
                    <td key={colIdx} className="py-4 px-4 text-sm whitespace-nowrap">
                      {col.render ? col.render(row) : (
                        col.accessor === 'status'
                          ? <StatusBadge status={row[col.accessor]} />
                          : <span className="font-semibold text-primary/90">{rawVal}</span>
                      )}
                    </td>
                  );
                })}

                {actions && (
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {customAction && customAction(row)}
                      {onView && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onView(row); }}
                          title="View"
                          className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {onEdit && canEdit && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                          title="Edit"
                          className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 transition-all flex items-center justify-center"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {onDelete && canDelete && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                          title="Delete"
                          className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-danger/10 transition-all flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer row count */}
        {data.length > 0 && (
          <div className="flex items-center justify-between px-4 pt-4 pb-1 border-t border-border/40 mt-1">
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
              {totalItems} {totalItems === 1 ? 'Record' : 'Records'}
            </p>
          </div>
        )}

      </div>

      {/* ── Mobile Card View ──────────────────────── */}
      <div className="md:hidden space-y-4">
        {displayData.map((row, rowIdx) => (
          <div
            key={row.id || row.requestId || rowIdx}
            className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-5 sm:p-6 space-y-5 hover:border-accent/40 transition-all duration-300 shadow-xl relative overflow-hidden group"
          >
            {/* Subtle Gradient Background on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex justify-between items-start relative z-10">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[9px] text-muted font-black uppercase tracking-[0.2em] mb-1.5 opacity-60">
                  {columns[0].header}
                </p>
                <div className="text-base font-black text-white italic tracking-tight truncate leading-tight">
                  {columns[0].render ? columns[0].render(row) : (
                    typeof row[columns[0].accessor] === 'object' && row[columns[0].accessor] !== null && !React.isValidElement(row[columns[0].accessor])
                      ? (row[columns[0].accessor].name || JSON.stringify(row[columns[0].accessor]))
                      : row[columns[0].accessor]
                  )}
                </div>
              </div>
              <StatusBadge status={row.status} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 relative z-10">
              {columns.slice(1, -1).map((col, colIdx) => {
                let rawVal = row[col.accessor];
                if (typeof rawVal === 'object' && rawVal !== null && !React.isValidElement(rawVal)) {
                  rawVal = rawVal.name || rawVal.title || JSON.stringify(rawVal);
                }
                return (
                  <div key={colIdx} className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-[1.25rem] flex flex-col justify-center">
                    <p className="text-[8px] text-muted font-black uppercase tracking-[0.2em] mb-1 opacity-70">
                      {col.header}
                    </p>
                    <div className="text-xs font-black text-white truncate">
                      {col.render ? col.render(row) : (
                        col.accessor === 'status' ? <StatusBadge status={row[col.accessor]} /> : rawVal
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {actions && (
              <div className="pt-5 border-t border-white/[0.08] flex flex-col gap-3 relative z-10">
                {customAction && (
                  <div className="w-full">
                    {customAction(row)}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {onView && (
                    <button
                      onClick={() => onView(row)}
                      className="flex-1 py-3 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-[0.97]"
                    >
                      <Eye size={14} className="text-accent" /> View
                    </button>
                  )}
                  {onEdit && canEdit && (
                    <button
                      onClick={() => onEdit(row)}
                      className="flex-1 py-3 bg-accent/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-accent hover:bg-accent/15 transition-all flex items-center justify-center gap-2 border border-accent/20 active:scale-[0.97]"
                    >
                      <Edit2 size={14} /> Update
                    </button>
                  )}
                  {onDelete && canDelete && (
                    <button
                      onClick={() => onDelete(row)}
                      className="p-3 bg-danger/5 rounded-xl text-danger hover:bg-danger/15 transition-all flex items-center justify-center border border-danger/20 active:scale-[0.97]"
                      title="Purge"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

      </div>

        </>
      )}

      {/* Shared Pagination */}
      {(totalPages > 1 || currentPage > 1) && (
        <div className="mt-6 mb-2">
          <BootstrapPagination
            activePage={currentPage}
            itemsCountPerPage={perPage}
            totalItemsCount={Math.max(totalItems, currentPage * perPage)}
            onChange={handlePage}
          />
        </div>
      )}
    </div>
  );
};

export default Table;
