import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Scaling } from 'lucide-react';
import { YamlEditorModal, ScaleModal } from './ActionModals';

interface Deployment {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
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

const DeploymentsView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [isScaleOpen, setIsScaleOpen] = useState(false);

    const fetchDeployments = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/deployments?namespace=${namespace}`);
            setDeployments(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch deployments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeployments();
    }, [namespace]);

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete deployment ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/deployments/${name}?namespace=${namespace}`);
            fetchDeployments();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/deployments/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedDeployment(deployments.find(d => d.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const handleScale = (deployment: Deployment) => {
        setSelectedDeployment(deployment);
        setIsScaleOpen(true);
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status', label: 'Status' },
        { key: 'spec.replicas', label: 'Replicas' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedDeployments = deployments.map(deployment => {
        const desired = deployment.spec.replicas;
        const ready = deployment.status.readyReplicas || 0;
        const available = deployment.status.availableReplicas || 0;
        const isHealthy = ready === desired && available === desired;

        return {
            'metadata.name': <span className="font-medium text-foreground">{deployment.metadata.name}</span>,
            'metadata.namespace': <span className="text-muted-foreground">{deployment.metadata.namespace}</span>,
            'status': (
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm">
                        {ready}/{desired} Ready
                    </span>
                </div>
            ),
            'spec.replicas': desired,
            'metadata.creationTimestamp': new Date(deployment.metadata.creationTimestamp).toLocaleString(),
            'actions': (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleScale(deployment)} className="p-1 hover:bg-muted rounded" title="Scale">
                        <Scaling className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleEditYaml(deployment.metadata.name, deployment.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(deployment.metadata.name, deployment.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        };
    });

    return (
        <div>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Deployments</h2>
                    <p className="text-muted-foreground">Manage your Kubernetes deployments.</p>
                </div>
                <button 
                    onClick={() => {
                        setYaml('');
                        setSelectedDeployment(null);
                        setIsYamlOpen(true);
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                    Create
                </button>
            </div>
            
            <Table
                data={processedDeployments}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchDeployments}
                resourceType="Deployment"
                resourceName={selectedDeployment?.metadata.name}
            />

            {selectedDeployment && (
                <ScaleModal
                    isOpen={isScaleOpen}
                    onClose={() => setIsScaleOpen(false)}
                    resourceType="deployments"
                    resourceName={selectedDeployment.metadata.name}
                    currentReplicas={selectedDeployment.spec.replicas}
                    onScale={fetchDeployments}
                />
            )}
        </div>
    );
};

export default DeploymentsView;
