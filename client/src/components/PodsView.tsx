import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';

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

const PodsView: React.FC = () => {
    const [pods, setPods] = useState<Pod[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPods = async () => {
            try {
                const response = await axios.get('/api/pods');
                setPods(response.data);
            } catch (err) {
                setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch pods');
            } finally {
                setLoading(false);
            }
        };

        fetchPods();
    }, []);

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status.phase', label: 'Status' },
        { key: 'spec.nodeName', label: 'Node' },
        { key: 'status.podIP', label: 'Pod IP' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
    ];

    const processedPods = pods.map(pod => ({
        'metadata.name': pod.metadata.name,
        'metadata.namespace': pod.metadata.namespace,
        'status.phase': pod.status.phase,
        'spec.nodeName': pod.spec.nodeName || '-',
        'status.podIP': pod.status.podIP || '-',
        'metadata.creationTimestamp': new Date(pod.metadata.creationTimestamp).toLocaleString(),
    }));

    return (
        <div>
            <Table
                data={processedPods}
                columns={columns}
                title="📦 Pods"
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default PodsView;