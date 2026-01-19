import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';

interface Node {
    metadata: {
        name: string;
        creationTimestamp: string;
    };
    status: {
        conditions: Array<{
            type: string;
            status: string;
        }>;
        nodeInfo: {
            kubeletVersion: string;
            osImage: string;
        };
    };
}

const NodesView: React.FC = () => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const response = await axios.get('/api/nodes');
                setNodes(response.data);
            } catch (err) {
                setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch nodes');
            } finally {
                setLoading(false);
            }
        };

        fetchNodes();
    }, []);

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'status.nodeInfo.kubeletVersion', label: 'Version' },
        { key: 'status.nodeInfo.osImage', label: 'OS' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
    ];

    const processedNodes = nodes.map(node => ({
        'metadata.name': node.metadata.name,
        'status.nodeInfo.kubeletVersion': node.status.nodeInfo?.kubeletVersion || 'Unknown',
        'status.nodeInfo.osImage': node.status.nodeInfo?.osImage || 'Unknown',
        'metadata.creationTimestamp': new Date(node.metadata.creationTimestamp).toLocaleString(),
    }));

    return (
        <div>
            <Table
                data={processedNodes}
                columns={columns}
                title="🌎 Nodes"
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default NodesView;