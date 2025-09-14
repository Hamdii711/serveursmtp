// Define the API exposed by the preload script
declare global {
    interface Window {
        api: {
            connect: (host: string, username: string, password: string) => Promise<boolean>;
            execute: (command: string) => Promise<string>;
            onCommandOutput: (callback: (data: string) => void) => void;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-btn');
    const uptimeBtn = document.getElementById('uptime-btn');
    const outputEl = document.getElementById('output');
    const connectionForm = document.getElementById('connection-form');
    const dashboard = document.getElementById('dashboard');

    if (connectBtn && outputEl && connectionForm && dashboard) {
        connectBtn.addEventListener('click', async () => {
            const host = (document.getElementById('host') as HTMLInputElement).value;
            const username = (document.getElementById('username') as HTMLInputElement).value;
            const password = (document.getElementById('password') as HTMLInputElement).value;

            outputEl.textContent = 'Connecting...';
            const success = await window.api.connect(host, username, password);
            
            if (success) {
                outputEl.textContent = 'Connected successfully!';
                connectionForm.classList.add('hidden');
                dashboard.classList.remove('hidden');
            } else {
                outputEl.textContent = 'Connection failed. Check credentials and server status.';
            }
        });
    }

    if (uptimeBtn && outputEl) {
        uptimeBtn.addEventListener('click', async () => {
            outputEl.textContent = 'Running uptime command...';
            const result = await window.api.execute('uptime');
            outputEl.textContent = result;
        });
    }

    // Example of listening for real-time output
    if (outputEl) {
        window.api.onCommandOutput((data: string) => {
            const newLog = document.createElement('p');
            newLog.textContent = data;
            outputEl.appendChild(newLog);
        });
    }
});

// Force this file to be treated as a module
export {};
