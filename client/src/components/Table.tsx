import React from 'react';

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

const styles = {
    table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '20px' },
    th: { border: '1px solid #3c4049', padding: '8px 12px', textAlign: 'left' as const, backgroundColor: '#20232a', color: '#61dafb' },
    td: { border: '1px solid #3c4049', padding: '8px 12px' },
    tr: { backgroundColor: '#282c34' },
    trAlt: { backgroundColor: '#20232a' },
};

function Table<T extends Record<string, any>>({ data, columns, title, loading = false, error }: TableProps<T>) {
    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div style={{ color: '#ff6961' }}>Error: {error}</div>;
    }

    if (data.length === 0) {
        return <div>No data available.</div>;
    }

    return (
        <div>
            {title && <h3 style={{ color: '#61dafb', marginBottom: '10px' }}>{title}</h3>}
            <table style={styles.table}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} style={styles.th}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={index} style={index % 2 === 0 ? styles.tr : styles.trAlt}>
                            {columns.map((col) => (
                                <td key={col.key} style={styles.td}>
                                    {item[col.key] || '-'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Table;