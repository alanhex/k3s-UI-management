import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';

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

const ServicesView: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await axios.get('/api/services');
                setServices(response.data);
            } catch (err) {
                setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch services');
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, []);

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'spec.type', label: 'Type' },
        { key: 'spec.clusterIP', label: 'Cluster IP' },
        { key: 'spec.ports', label: 'Ports' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
    ];

    const processedServices = services.map(service => {
        const ports = service.spec.ports?.map(p => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ') || '-';
        return {
            'metadata.name': service.metadata.name,
            'metadata.namespace': service.metadata.namespace,
            'spec.type': service.spec.type,
            'spec.clusterIP': service.spec.clusterIP || '-',
            'spec.ports': ports,
            'metadata.creationTimestamp': new Date(service.metadata.creationTimestamp).toLocaleString(),
        };
    });

    return (
        <div>
            <Table
                data={processedServices}
                columns={columns}
                title="⚙️ Services"
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default ServicesView;