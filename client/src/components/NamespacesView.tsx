import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2 } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface Namespace {
    metadata: {
        name: string;
        creationTimestamp: string;
        status: {
            phase: string;
        };
    };
    status: {
        phase: string;
    };
}

const NamespacesView: React.FC = () => {
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);

    const fetchNamespaces = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/namespaces');
            setNamespaces(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch namespaces');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNamespaces();
    }, []);

    const handleDelete = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete namespace ${name}? This will delete ALL resources within it.`)) return;
        try {
            await axios.delete(`/api/resources/namespaces/${name}`);
            fetchNamespaces();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string) => {
        try {
            const response = await axios.get(`/api/resources/namespaces/${name}/yaml`);
            setYaml(response.data.yaml);
            setSelectedNamespace(namespaces.find(n => n.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'status.phase', label: 'Status' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedNamespaces = namespaces.map(ns => ({
        'metadata.name': <span className="font-medium text-foreground">{ns.metadata.name}</span>,
        'status.phase': (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                ns.status.phase === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
                {ns.status.phase}
            </span>
        ),
        'metadata.creationTimestamp': new Date(ns.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(ns.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button 
                    onClick={() => handleDelete(ns.metadata.name)} 
                    className="p-1 hover:bg-destructive/10 text-destructive rounded" 
                    title="Delete"
                    disabled={['default', 'kube-system', 'kube-public', 'kube-node-lease'].includes(ns.metadata.name)}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    return (
        <div>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Namespaces</h2>
                    <p className="text-muted-foreground">Isolate groups of resources within a single cluster.</p>
                </div>
                <button 
                    onClick={() => {
                        setYaml('apiVersion: v1\nkind: Namespace\nmetadata:\n  name: my-namespace');
                        setSelectedNamespace(null);
                        setIsYamlOpen(true);
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                    Create
                </button>
            </div>
            
            <Table
                data={processedNamespaces}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchNamespaces}
                resourceType="Namespace"
                resourceName={selectedNamespace?.metadata.name}
            />
        </div>
    );
};

export default NamespacesView;
