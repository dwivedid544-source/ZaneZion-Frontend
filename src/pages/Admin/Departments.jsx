import React, { useState } from 'react';
import { Building2, Plus, RefreshCcw } from 'lucide-react';
import { useDepartments } from '../../hooks/api/useAdminCore';
import Table from '../../components/Table';
import Pagination from '../../components/Common/Pagination';

const Departments = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const { data, isLoading, error } = useDepartments(page, 10, search);

    const departments = data?.data || [];
    const meta = data?.meta || { totalPages: 1, totalItems: 0 };

    const columns = [
        { header: "Department ID", accessor: "id" },
        { header: "Name", accessor: "name", render: (row) => <span className="font-bold">{row.name}</span> },
        { header: "Head of Dept", accessor: "manager", render: (row) => row.manager?.name || 'Unassigned' },
        { 
            header: "Status", 
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${row.status === 'active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    {row.status || 'Active'}
                </span>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                        <Building2 className="text-accent" /> Departments
                    </h1>
                    <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                        Manage Organizational Structure
                    </p>
                </div>
            </div>

            <div className="glass-card p-6 border-white/5">
                {isLoading ? (
                    <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
                ) : error ? (
                    <div className="text-danger p-4">Failed to load departments.</div>
                ) : (
                    <>
                        <Table columns={columns} data={departments} />
                        <div className="mt-6 border-t border-white/5 pt-6">
                            <Pagination
                                currentPage={page}
                                totalPages={meta.totalPages}
                                onPageChange={setPage}
                                totalItems={meta.totalItems}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Departments;
