import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2 } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface Pod {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    status: {
        phase: string;
        podIP?: string;
        hostIP?: string;
    };
    spec: {
        nodeName?: string;
    };
}

const PodsView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [pods, setPods] = useState<Pod[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);

    const fetchPods = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/pods?namespace=${namespace}`);
            setPods(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch pods');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPods();
    }, [namespace]);

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete pod ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/pods/${name}?namespace=${namespace}`);
            fetchPods();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/pods/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedPod(pods.find(p => p.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status.phase', label: 'Status' },
        { key: 'spec.nodeName', label: 'Node' },
        { key: 'status.podIP', label: 'Pod IP' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const getStatusColor = (phase: string) => {
        switch (phase.toLowerCase()) {
            case 'running': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
            case 'succeeded': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
            case 'failed': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
            case 'pending': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
            default: return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
        }
    };

    const processedPods = pods.map(pod => ({
        'metadata.name': <span className="font-medium text-foreground">{pod.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{pod.metadata.namespace}</span>,
        'status.phase': (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getStatusColor(pod.status.phase)}`}>
                {pod.status.phase}
            </span>
        ),
        'spec.nodeName': pod.spec.nodeName || '-',
        'status.podIP': pod.status.podIP || '-',
        'metadata.creationTimestamp': new Date(pod.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(pod.metadata.name, pod.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(pod.metadata.name, pod.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Pods</h2>
                <p className="text-muted-foreground">List of all pods in the default namespace.</p>
            </div>
            <Table
                data={processedPods}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchPods}
                resourceType="Pod"
                resourceName={selectedPod?.metadata.name}
            />
        </div>
    );
};

export default PodsView;
