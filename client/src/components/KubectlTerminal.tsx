import React, { useState, useCallback } from 'react';
import axios from 'axios';

// Component Styles
const styles = {
    terminalContainer: { height: '100%', display: 'flex', flexDirection: 'column' as const },
    outputArea: { flexGrow: 1, backgroundColor: '#1e1e1e', padding: '15px', overflowY: 'scroll' as const, fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const, border: '1px solid #333', borderRadius: '4px' },
    inputArea: { display: 'flex', marginTop: '10px' },
    commandInput: { flexGrow: 1, padding: '10px', backgroundColor: '#333', color: '#fff', border: 'none', fontFamily: 'monospace', fontSize: '1em', borderRadius: '4px 0 0 4px' },
    submitButton: { padding: '10px 20px', backgroundColor: '#61dafb', color: '#282c34', border: 'none', cursor: 'pointer', fontWeight: 'bold' as const, borderRadius: '0 4px 4px 0', transition: 'background-color 0.2s' },
    error: { color: '#ff6961', fontWeight: 'bold' as const },
    prompt: { color: '#00ff00', fontWeight: 'bold' as const },
};

interface CommandResult {
    command: string;
    output?: string;
    error?: string;
}

const KubectlTerminal: React.FC = () => {
    const [command, setCommand] = useState<string>('');
    const [history, setHistory] = useState<CommandResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const executeCommand = useCallback(async (cmd: string) => {
        if (!cmd.trim()) return;

        setIsLoading(true);

        const newResult: CommandResult = { command: cmd };

        try {
            const response = await axios.post('/api/kubectl', { command: cmd.trim() });
            newResult.output = response.data.output;
        } catch (error) {
            let errorMessage = 'An unknown error occurred.';
            if (axios.isAxiosError(error) && error.response) {
                // Backend error with details
                errorMessage = error.response.data.details || error.response.data.error || errorMessage;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            newResult.error = errorMessage;
        } finally {
            setHistory(prev => [...prev, newResult]);
            setCommand('');
            setIsLoading(false);
            // Scroll to bottom
            setTimeout(() => {
                const outputArea = document.getElementById('terminal-output');
                if (outputArea) {
                    outputArea.scrollTop = outputArea.scrollHeight;
                }
            }, 0);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeCommand(command);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSubmit(e as unknown as React.FormEvent);
        }
    };

    return (
        <div style={styles.terminalContainer}>
            <h2 style={{ color: '#61dafb', marginBottom: '15px' }}>⚡ Kubectl Terminal (Full Access)</h2>
            <div style={{ color: '#ff6961', fontSize: '0.9em', marginBottom: '15px', fontWeight: 'bold' }}>
                ⚠️ WARNING: All kubectl commands are allowed, including destructive operations (delete, create, apply, etc.)
            </div>
            <div id="terminal-output" style={styles.outputArea}>
                {history.map((item, index) => (
                    <div key={index} style={{ marginBottom: '15px' }}>
                        <span style={styles.prompt}>$ kubectl </span>
                        <span style={{ color: '#fff' }}>{item.command.startsWith('kubectl ') ? item.command.substring(8) : item.command}</span>
                        <pre style={{ margin: '5px 0 0 0', color: item.error ? styles.error.color : '#eee', lineHeight: '1.4' }}>
                            {item.error ? `Error: ${item.error}` : item.output}
                        </pre>
                    </div>
                ))}
                {isLoading && <div><span style={styles.prompt}>$ kubectl </span><span style={{ color: '#fff' }}>Executing...</span></div>}
            </div>
            <form onSubmit={handleSubmit} style={styles.inputArea}>
                <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., kubectl create deployment nginx --image=nginx"
                    style={styles.commandInput}
                    disabled={isLoading}
                />
                <button type="submit" style={styles.submitButton} disabled={isLoading}>
                    {isLoading ? 'Running...' : 'Execute'}
                </button>
            </form>
        </div>
    );
};

export default KubectlTerminal;