import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface Column {
    key: string;
    label: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column[];
    title?: string;
    loading?: boolean;
    error?: string | null;
}

function Table<T extends Record<string, any>>({ data, columns, title, loading = false, error }: TableProps<T>) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>Error: {error}</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {title && <h3 className="text-lg font-medium tracking-tight">{title}</h3>}
            
            <div className="rounded-md border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                {columns.map((col) => (
                                    <th 
                                        key={col.key} 
                                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        No data available.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, index) => (
                                    <tr 
                                        key={index} 
                                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                    >
                                        {columns.map((col) => (
                                            <td key={col.key} className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                                                {item[col.key] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Table;
