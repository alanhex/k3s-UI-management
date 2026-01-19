import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2 } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface Service {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    spec: {
        type: string;
        clusterIP?: string;
        externalIP?: string[];
        ports?: Array<{
            port: number;
            targetPort: number | string;
            protocol: string;
        }>;
    };
    status: {
        loadBalancer?: {
            ingress?: Array<{
                ip?: string;
                hostname?: string;
            }>;
        };
    };
}

const ServicesView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/services?namespace=${namespace}`);
            setServices(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, [namespace]);

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete service ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/services/${name}?namespace=${namespace}`);
            fetchServices();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/services/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedService(services.find(s => s.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'spec.type', label: 'Type' },
        { key: 'spec.clusterIP', label: 'Cluster IP' },
        { key: 'spec.ports', label: 'Ports' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedServices = services.map(service => {
        const ports = service.spec.ports?.map(p => (
            <span key={`${p.port}-${p.protocol}`} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 mr-1">
                {p.port}:{p.targetPort}/{p.protocol}
            </span>
        )) || '-';

        return {
            'metadata.name': <span className="font-medium text-foreground">{service.metadata.name}</span>,
            'metadata.namespace': <span className="text-muted-foreground">{service.metadata.namespace}</span>,
            'spec.type': (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                    {service.spec.type}
                </span>
            ),
            'spec.clusterIP': <span className="font-mono text-xs">{service.spec.clusterIP || '-'}</span>,
            'spec.ports': <div>{ports}</div>,
            'metadata.creationTimestamp': new Date(service.metadata.creationTimestamp).toLocaleString(),
            'actions': (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleEditYaml(service.metadata.name, service.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(service.metadata.name, service.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        };
    });

    return (
        <div>
             <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Services</h2>
                <p className="text-muted-foreground">Networking and load balancing.</p>
            </div>
            <Table
                data={processedServices}
                columns={columns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchServices}
                resourceType="Service"
                resourceName={selectedService?.metadata.name}
            />
        </div>
    );
};

export default ServicesView;
