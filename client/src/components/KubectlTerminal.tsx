import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Play, AlertTriangle, Trash2 } from 'lucide-react';

interface CommandResult {
    command: string;
    output?: string;
    error?: string;
}

const KubectlTerminal: React.FC = () => {
    const [command, setCommand] = useState<string>('');
    const [history, setHistory] = useState<CommandResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    
    // Command history for navigation
    const [commandHistory, setCommandHistory] = useState<string[]>([]);

    const outputEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isLoading]);

    // Focus input on mount with a slight delay
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Global listener to capture keystrokes when focus is lost (e.g. on body)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is already on the input or another interactive element
            if (document.activeElement === inputRef.current) return;
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLButtonElement) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            // If typing alphanumeric or navigation keys, focus the terminal input
            if (e.key.length === 1 || ['ArrowUp', 'ArrowDown', 'Backspace', 'Enter', 'Tab'].includes(e.key)) {
                inputRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const executeCommand = useCallback(async (cmd: string) => {
        if (!cmd.trim()) return;

        setIsLoading(true);

        const cleanCmd = cmd.trim().startsWith('kubectl ') ? cmd.trim().substring(8) : cmd.trim();

        const newResult: CommandResult = { command: cleanCmd };

        setCommandHistory(prev => [...prev, cmd.trim()]);
        setHistoryIndex(-1);

        try {
            const fullCommand = `kubectl ${cleanCmd}`;
            const response = await axios.post('/api/kubectl', { command: fullCommand });
            
            if (!response.data.output && !response.data.error) {
                newResult.output = "No resources found in default namespace.";
            } else {
                newResult.output = response.data.output;
            }
        } catch (error: any) {
            let errorMessage = 'An unknown error occurred.';
            if (axios.isAxiosError(error) && error.response) {
                errorMessage = error.response.data.details || error.response.data.error || errorMessage;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            newResult.error = errorMessage;
        } finally {
            setHistory(prev => [...prev, newResult]);
            setCommand('');
            setIsLoading(false);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeCommand(command);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'Up') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setCommand(commandHistory[newIndex]);
                console.log('History Up:', newIndex, commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown' || e.key === 'Down') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setCommand('');
                    console.log('History End');
                } else {
                    setHistoryIndex(newIndex);
                    setCommand(commandHistory[newIndex]);
                    console.log('History Down:', newIndex, commandHistory[newIndex]);
                }
            }
        }
    };

    const clearHistory = () => {
        setHistory([]);
        setCommandHistory([]);
        setHistoryIndex(-1);
    };

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold tracking-tight">Interactive Kubectl Terminal</h2>
                </div>
                <button 
                    onClick={clearHistory}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="h-3 w-3" /> Clear History
                </button>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                <span>Caution: This terminal has full administrative access to your cluster.</span>
            </div>

            <div 
                className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-[#1e1e1e] font-mono text-sm text-[#cccccc] shadow-inner"
                onClick={() => inputRef.current?.focus()}
            >
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700">
                    <div className="space-y-4">
                        <div className="text-gray-500">
                            Welcome to K3s UI Terminal v1.0.0
                            <br/>Type 'kubectl help' to see available commands.
                        </div>
                        
                        {history.map((item, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-500">➜</span>
                                    <span className="text-blue-400">~</span>
                                    <span className="font-bold text-white">kubectl {item.command}</span>
                                </div>
                                {item.error ? (
                                    <div className="text-red-400 whitespace-pre-wrap pl-4 border-l-2 border-red-500/50">
                                        Error: {item.error}
                                    </div>
                                ) : (
                                    <div className="text-gray-300 whitespace-pre-wrap pl-4 border-l-2 border-gray-700/50">
                                        {item.output}
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="flex items-center gap-2 animate-pulse">
                                <span className="text-green-500">➜</span>
                                <span className="text-blue-400">~</span>
                                <span className="text-white">Executing...</span>
                            </div>
                        )}
                        <div ref={outputEndRef} />
                    </div>
                </div>

                <div className="border-t border-gray-800 bg-[#252526] p-2">
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <span className="text-green-500 pl-2">➜</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 focus:ring-0"
                            placeholder="kubectl get pods -A"
                            disabled={isLoading}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !command.trim()}
                            className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50"
                        >
                            <Play className="h-4 w-4 fill-current" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default KubectlTerminal;
