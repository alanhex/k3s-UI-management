import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';

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

const DeploymentsView: React.FC = () => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDeployments = async () => {
            try {
                const response = await axios.get('/api/deployments');
                setDeployments(response.data);
            } catch (err) {
                setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch deployments');
            } finally {
                setLoading(false);
            }
        };

        fetchDeployments();
    }, []);

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'spec.replicas', label: 'Desired' },
        { key: 'status.readyReplicas', label: 'Ready' },
        { key: 'status.availableReplicas', label: 'Available' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
    ];

    const processedDeployments = deployments.map(deployment => ({
        'metadata.name': deployment.metadata.name,
        'metadata.namespace': deployment.metadata.namespace,
        'spec.replicas': deployment.spec.replicas,
        'status.readyReplicas': deployment.status.readyReplicas || 0,
        'status.availableReplicas': deployment.status.availableReplicas || 0,
        'metadata.creationTimestamp': new Date(deployment.metadata.creationTimestamp).toLocaleString(),
    }));

    return (
        <div>
            <Table
                data={processedDeployments}
                columns={columns}
                title="🚀 Deployments"
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default DeploymentsView;