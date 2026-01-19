import React, { useState } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-lg border bg-card text-card-foreground shadow-lg animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b p-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
                {footer && <div className="border-t p-4 bg-muted/20 rounded-b-lg">{footer}</div>}
            </div>
        </div>
    );
};

interface YamlEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialYaml?: string;
    onSave: () => void;
    resourceType?: string; // Optional resource type context
    resourceName?: string; // Optional resource name context
}

export const YamlEditorModal: React.FC<YamlEditorModalProps> = ({ isOpen, onClose, initialYaml = '', onSave, resourceType, resourceName }) => {
    const [yaml, setYaml] = useState(initialYaml);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update local state when initialYaml changes (e.g. when fetching completes)
    React.useEffect(() => {
        setYaml(initialYaml);
    }, [initialYaml]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await axios.post('/api/resources/apply', { yaml });
            onSave();
            onClose();
        } catch (err: any) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.details || err.message : 'Failed to apply YAML';
            setError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={resourceName ? `Edit ${resourceType}: ${resourceName}` : 'Create Resource'}
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border hover:bg-accent">Cancel</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? 'Applying...' : 'Apply'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-mono whitespace-pre-wrap">{error}</span>
                    </div>
                )}
                <textarea
                    value={yaml}
                    onChange={(e) => setYaml(e.target.value)}
                    className="w-full h-[400px] font-mono text-sm bg-muted/50 p-4 rounded-md border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    spellCheck={false}
                    placeholder="# Paste Kubernetes YAML here..."
                />
            </div>
        </Modal>
    );
};

interface ScaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceType: string;
    resourceName: string;
    currentReplicas: number;
    onScale: () => void;
}

interface InstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    chart: any;
    namespace: string;
    onInstall: () => void;
}

export const ScaleModal: React.FC<ScaleModalProps> = ({ isOpen, onClose, resourceType, resourceName, currentReplicas, onScale }) => {
    const [replicas, setReplicas] = useState(currentReplicas);
    const [isScaling, setIsScaling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleScale = async () => {
        setIsScaling(true);
        setError(null);
        try {
            await axios.post(`/api/resources/${resourceType}/${resourceName}/scale`, { replicas });
            onScale();
            onClose();
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.response?.data?.details || err.message : 'Failed to scale');
        } finally {
            setIsScaling(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Scale ${resourceType}: ${resourceName}`}
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border hover:bg-accent">Cancel</button>
                    <button
                        onClick={handleScale}
                        disabled={isScaling}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isScaling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scale'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                        {error}
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Desired Replicas</label>
                    <input
                        type="number"
                        min="0"
                        value={replicas}
                        onChange={(e) => setReplicas(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>
        </Modal>
    );
};

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, chart, namespace, onInstall }) => {
    const [releaseName, setReleaseName] = useState(chart?.name || '');
    const [targetNamespace, setTargetNamespace] = useState(namespace);
    const [valuesYaml, setValuesYaml] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInstall = async () => {
        setIsInstalling(true);
        setError(null);
        try {
            await axios.post('/api/helm/install', {
                chart: chart.name,
                repo: chart.repository?.url,
                version: chart.version,
                releaseName,
                namespace: targetNamespace,
                valuesYaml
            });
            onInstall();
            onClose();
        } catch (err: any) {
            const errorMsg = axios.isAxiosError(err) ? err.response?.data?.details || err.message : err.message || 'Failed to install chart';
            if (errorMsg.includes('library charts are not installable')) {
                setError('This chart is a library chart and cannot be installed directly. Library charts are meant to be used as dependencies by other charts.');
            } else {
                setError(errorMsg);
            }
        } finally {
            setIsInstalling(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Install Helm Chart: ${chart?.name || 'Unknown'}`}
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border hover:bg-accent">Cancel</button>
                    <button
                        onClick={handleInstall}
                        disabled={isInstalling}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Install'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Release Name</label>
                        <input
                            type="text"
                            value={releaseName}
                            onChange={(e) => setReleaseName(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="my-release"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Target Namespace</label>
                        <input
                            type="text"
                            value={targetNamespace}
                            onChange={(e) => setTargetNamespace(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="default"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Values (YAML)</label>
                    <textarea
                        value={valuesYaml}
                        onChange={(e) => setValuesYaml(e.target.value)}
                        className="w-full h-32 font-mono text-sm bg-muted/50 p-3 rounded-md border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        spellCheck={false}
                        placeholder="# Optional: Override default values"
                    />
                </div>
                <div className="text-sm text-muted-foreground">
                    <p>Chart: {chart?.name} v{chart?.version}</p>
                    <p>Repository: {chart?.repository?.name}</p>
                </div>
            </div>
        </Modal>
    );
};
