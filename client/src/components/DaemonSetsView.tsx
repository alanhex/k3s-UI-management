import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2 } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface DaemonSet {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    status: {
        desiredNumberScheduled: number;
        currentNumberScheduled: number;
        numberReady: number;
        numberAvailable: number;
        numberMisscheduled: number;
    };
    spec: {
        template: {
            spec: {
                nodeSelector?: Record<string, string>;
                tolerations?: Array<{
                    key?: string;
                    operator?: string;
                    value?: string;
                    effect?: string;
                }>;
            };
        };
    };
}

const DaemonSetsView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [daemonSets, setDaemonSets] = useState<DaemonSet[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDaemonSet, setSelectedDaemonSet] = useState<DaemonSet | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);

    const fetchDaemonSets = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/daemonsets?namespace=${namespace}`);
            setDaemonSets(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch daemonsets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDaemonSets();
    }, [namespace]);

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete daemonset ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/daemonsets/${name}?namespace=${namespace}`);
            fetchDaemonSets();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/daemonsets/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedDaemonSet(daemonSets.find(d => d.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status', label: 'Status' },
        { key: 'spec.nodeSelector', label: 'Node Selector' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedDaemonSets = daemonSets.map(ds => {
        const desired = ds.status.desiredNumberScheduled;
        const current = ds.status.currentNumberScheduled;
        const ready = ds.status.numberReady;
        const isHealthy = ready === desired;

        return {
            'metadata.name': <span className="font-medium text-foreground">{ds.metadata.name}</span>,
            'metadata.namespace': <span className="text-muted-foreground">{ds.metadata.namespace}</span>,
            'status': (
                <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className="font-medium">{ready}/{desired} Ready</span>
                    </div>
                    <span className="text-muted-foreground">Current: {current}</span>
                </div>
            ),
            'spec.nodeSelector': ds.spec.template.spec.nodeSelector ? (
                <div className="flex flex-wrap gap-1">
                    {Object.entries(ds.spec.template.spec.nodeSelector).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                            {k}: {v}
                        </span>
                    ))}
                </div>
            ) : <span className="text-muted-foreground">-</span>,
            'metadata.creationTimestamp': new Date(ds.metadata.creationTimestamp).toLocaleString(),
            'actions': (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleEditYaml(ds.metadata.name, ds.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(ds.metadata.name, ds.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        };
    });

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">DaemonSets</h2>
                <p className="text-muted-foreground">Ensures a copy of a Pod runs on all (or some) Nodes.</p>
            </div>
            <Table
                data={processedDaemonSets}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchDaemonSets}
                resourceType="DaemonSet"
                resourceName={selectedDaemonSet?.metadata.name}
            />
        </div>
    );
};

export default DaemonSetsView;
