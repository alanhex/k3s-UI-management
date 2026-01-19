import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Package, Settings, Search, Download } from 'lucide-react';
import { YamlEditorModal, InstallModal } from './ActionModals';

interface HelmChart {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    spec: {
        chart?: string;
        repo?: string;
        version?: string;
        targetNamespace?: string;
        helmVersion?: string;
    };
    status?: {
        jobName?: string;
    };
}

interface HelmChartConfig {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    spec: {
        valuesContent?: string;
    };
}

const HelmView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'charts' | 'configs'>('charts');
    const [charts, setCharts] = useState<HelmChart[]>([]);
    const [configs, setConfigs] = useState<HelmChartConfig[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<string | null>(null);
    const [isInstallOpen, setIsInstallOpen] = useState(false);
    const [selectedChart, setSelectedChart] = useState<any>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            if (activeTab === 'charts') {
                const response = await axios.get(`/api/helmcharts?namespace=${namespace}`);
                setCharts(response.data);
            } else {
                const response = await axios.get(`/api/helmchartconfigs?namespace=${namespace}`);
                setConfigs(response.data);
            }
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : `Failed to fetch ${activeTab}`);
        } finally {
            setLoading(false);
        }
    };

    const searchCharts = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            setSearching(true);
            setSearchError(null);
            const response = await axios.get(`/api/helm/search?query=${encodeURIComponent(query)}`);
            setSearchResults(response.data.packages || []);
        } catch (err: any) {
            setSearchError(axios.isAxiosError(err) ? err.message : 'Search failed');
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [namespace, activeTab]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            searchCharts(searchQuery);
        }, 300); // 300ms debounce
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, searchCharts]);

    const getResourceType = () => {
        switch (activeTab) {
            case 'charts': return 'helmcharts.helm.cattle.io';
            case 'configs': return 'helmchartconfigs.helm.cattle.io';
        }
    };

    const handleDelete = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/${getResourceType()}/${name}?namespace=${namespace}`);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string) => {
        try {
            const response = await axios.get(`/api/resources/${getResourceType()}/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedResource(name);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const handleInstallChart = (chart: any) => {
        setSelectedChart(chart);
        setIsInstallOpen(true);
    };

    const chartColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'spec.chart', label: 'Chart' },
        { key: 'spec.targetNamespace', label: 'Target NS' },
        { key: 'spec.version', label: 'Version' },
        { key: 'status.jobName', label: 'Job' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const configColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const searchColumns = [
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'version', label: 'Version' },
        { key: 'organizations', label: 'Organizations' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedCharts = charts.map(chart => ({
        'metadata.name': <span className="font-medium text-foreground">{chart.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{chart.metadata.namespace}</span>,
        'spec.chart': <span className="text-sm font-medium">{chart.spec.chart || '-'}</span>,
        'spec.targetNamespace': <span className="text-xs text-muted-foreground">{chart.spec.targetNamespace || '-'}</span>,
        'spec.version': <span className="text-xs font-mono">{chart.spec.version || 'latest'}</span>,
        'status.jobName': <span className="text-xs text-muted-foreground">{chart.status?.jobName || '-'}</span>,
        'metadata.creationTimestamp': new Date(chart.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(chart.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(chart.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedConfigs = configs.map(config => ({
        'metadata.name': <span className="font-medium text-foreground">{config.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{config.metadata.namespace}</span>,
        'metadata.creationTimestamp': new Date(config.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(config.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(config.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedSearchResults = searchResults.map(result => ({
        'name': <span className="font-medium text-foreground">{result.name}</span>,
        'description': <span className="text-sm text-muted-foreground">{result.description || 'No description'}</span>,
        'version': <span className="text-xs font-mono">{result.version}</span>,
        'organizations': <span className="text-xs text-muted-foreground">{result.production_organizations_count || 0}</span>,
        'actions': (
            <button onClick={() => handleInstallChart(result)} className="p-1 hover:bg-muted rounded" title="Install Chart">
                <Download className="h-4 w-4" />
            </button>
        )
    }));

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Helm Management (k3s)</h2>
                        <p className="text-muted-foreground">Search Artifact Hub, manage HelmCharts and configs via the Helm Controller.</p>
                    </div>
                    <button
                        onClick={() => {
                            let template = '';
                            if (activeTab === 'charts') {
                                template = 'apiVersion: helm.cattle.io/v1\nkind: HelmChart\nmetadata:\n  name: my-chart\n  namespace: kube-system\nspec:\n  chart: traefik\n  repo: https://helm.traefik.io/traefik\n  targetNamespace: traefik-system';
                            } else {
                                template = 'apiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: my-chart-config\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    key: value';
                            }
                            setYaml(template);
                            setSelectedResource(null);
                            setIsYamlOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    >
                        Create {activeTab === 'charts' ? 'HelmChart' : 'Config'}
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search Helm charts on Artifact Hub..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                </div>

                {searchQuery.trim() ? (
                    <>
                        {searching && <p className="text-sm text-muted-foreground mb-2">Searching...</p>}
                        {searchError && <p className="text-sm text-destructive mb-2">{searchError}</p>}
                        {searchResults.length > 0 && <p className="text-sm text-muted-foreground mb-2">Found {searchResults.length} charts</p>}
                    </>
                ) : (
                    <div className="flex space-x-1 rounded-lg bg-muted p-1 w-fit mb-4">
                        <button
                            onClick={() => setActiveTab('charts')}
                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                activeTab === 'charts'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                            }`}
                        >
                            <Package className="h-4 w-4" />
                            HelmCharts
                        </button>
                        <button
                            onClick={() => setActiveTab('configs')}
                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                activeTab === 'configs'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                            }`}
                        >
                            <Settings className="h-4 w-4" />
                            Configs
                        </button>
                    </div>
                )}
            </div>

            {searchQuery.trim() ? (
                <Table
                    data={processedSearchResults}
                    columns={searchColumns}
                    loading={searching}
                    error={searchError}
                />
            ) : (
                <Table
                    data={activeTab === 'charts' ? processedCharts : processedConfigs}
                    columns={activeTab === 'charts' ? chartColumns : configColumns}
                    loading={loading}
                    error={error}
                />
            )}

            <YamlEditorModal
                isOpen={isYamlOpen}
                onClose={() => setIsYamlOpen(false)}
                initialYaml={yaml}
                onSave={fetchData}
                resourceType={activeTab === 'charts' ? 'HelmChart' : 'HelmChartConfig'}
                resourceName={selectedResource || undefined}
            />

            <InstallModal
                isOpen={isInstallOpen}
                onClose={() => setIsInstallOpen(false)}
                chart={selectedChart}
                namespace={namespace}
                onInstall={fetchData}
            />
        </div>
    );
};

export default HelmView;
