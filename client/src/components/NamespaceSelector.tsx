import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown, Layers } from 'lucide-react';

interface Namespace {
    metadata: {
        name: string;
    };
}

interface NamespaceSelectorProps {
    selected: string;
    onSelect: (namespace: string) => void;
}

const NamespaceSelector: React.FC<NamespaceSelectorProps> = ({ selected, onSelect }) => {
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchNamespaces = async () => {
            try {
                const response = await axios.get('/api/namespaces');
                setNamespaces(response.data);
            } catch (error) {
                console.error('Failed to fetch namespaces');
            }
        };
        fetchNamespaces();
    }, []);

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
            >
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span>{selected}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-md border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95">
                        <div className="max-h-64 overflow-auto">
                            {namespaces.map((ns) => (
                                <button
                                    key={ns.metadata.name}
                                    onClick={() => {
                                        onSelect(ns.metadata.name);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground ${
                                        selected === ns.metadata.name ? 'bg-accent/50 font-medium' : ''
                                    }`}
                                >
                                    {ns.metadata.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NamespaceSelector;
