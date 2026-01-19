import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Scaling } from 'lucide-react';
import { YamlEditorModal, ScaleModal } from './ActionModals';

interface ReplicaSet {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
        ownerReferences?: Array<{
            kind: string;
            name: string;
        }>;
    };
    status: {
        replicas: number;
        readyReplicas: number;
        availableReplicas: number;
    };
    spec: {
        replicas: number;
    };
}

const ReplicaSetsView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [replicaSets, setReplicaSets] = useState<ReplicaSet[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedReplicaSet, setSelectedReplicaSet] = useState<ReplicaSet | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [isScaleOpen, setIsScaleOpen] = useState(false);

    const fetchReplicaSets = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/replicasets?namespace=${namespace}`);
            setReplicaSets(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch replicasets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReplicaSets();
    }, [namespace]);

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete replicaset ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/replicasets/${name}?namespace=${namespace}`);
            fetchReplicaSets();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/replicasets/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedReplicaSet(replicaSets.find(r => r.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const handleScale = (rs: ReplicaSet) => {
        setSelectedReplicaSet(rs);
        setIsScaleOpen(true);
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status', label: 'Status' },
        { key: 'metadata.ownerReferences', label: 'Controlled By' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedReplicaSets = replicaSets.map(rs => {
        const desired = rs.spec.replicas;
        const ready = rs.status.readyReplicas || 0;
        const current = rs.status.replicas;
        const isHealthy = ready === desired;

        return {
            'metadata.name': <span className="font-medium text-foreground">{rs.metadata.name}</span>,
            'metadata.namespace': <span className="text-muted-foreground">{rs.metadata.namespace}</span>,
            'status': (
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm">
                        {ready}/{desired} Ready
                    </span>
                </div>
            ),
            'metadata.ownerReferences': rs.metadata.ownerReferences?.map(ref => (
                <span key={ref.name} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    {ref.kind}/{ref.name}
                </span>
            )) || <span className="text-muted-foreground">-</span>,
            'metadata.creationTimestamp': new Date(rs.metadata.creationTimestamp).toLocaleString(),
            'actions': (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleScale(rs)} className="p-1 hover:bg-muted rounded" title="Scale">
                        <Scaling className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleEditYaml(rs.metadata.name, rs.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(rs.metadata.name, rs.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        };
    });

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">ReplicaSets</h2>
                <p className="text-muted-foreground">Maintains a stable set of replica Pods.</p>
            </div>
            <Table
                data={processedReplicaSets}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchReplicaSets}
                resourceType="ReplicaSet"
                resourceName={selectedReplicaSet?.metadata.name}
            />

            {selectedReplicaSet && (
                <ScaleModal
                    isOpen={isScaleOpen}
                    onClose={() => setIsScaleOpen(false)}
                    resourceType="replicasets"
                    resourceName={selectedReplicaSet.metadata.name}
                    currentReplicas={selectedReplicaSet.spec.replicas}
                    onScale={fetchReplicaSets}
                />
            )}
        </div>
    );
};

export default ReplicaSetsView;
