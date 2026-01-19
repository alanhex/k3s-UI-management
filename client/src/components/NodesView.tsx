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
            } catch (err: any) {
                setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch nodes');
            } finally {
                setLoading(false);
            }
        };

        fetchNodes();
    }, []);

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'status.conditions', label: 'Status' },
        { key: 'status.nodeInfo.kubeletVersion', label: 'Version' },
        { key: 'status.nodeInfo.osImage', label: 'OS' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
    ];

    const processedNodes = nodes.map(node => {
        const isReady = node.status.conditions.find(c => c.type === 'Ready')?.status === 'True';
        
        return {
            'metadata.name': (
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-1">
                        <svg className="h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                    </div>
                    <span className="font-medium text-foreground">{node.metadata.name}</span>
                </div>
            ),
            'status.conditions': (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${isReady ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}>
                    {isReady ? 'Ready' : 'Not Ready'}
                </span>
            ),
            'status.nodeInfo.kubeletVersion': <span className="font-mono text-xs text-muted-foreground">{node.status.nodeInfo?.kubeletVersion || 'Unknown'}</span>,
            'status.nodeInfo.osImage': <span className="text-sm text-muted-foreground">{node.status.nodeInfo?.osImage || 'Unknown'}</span>,
            'metadata.creationTimestamp': new Date(node.metadata.creationTimestamp).toLocaleString(),
        };
    });

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Nodes</h2>
                <p className="text-muted-foreground">Cluster compute resources.</p>
            </div>
            <Table
                data={processedNodes}
                columns={columns}
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default NodesView;
