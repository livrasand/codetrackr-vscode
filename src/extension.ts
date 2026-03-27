import * as vscode from 'vscode';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    const logger = vscode.window.createOutputChannel("CodeTrackr");
    logger.appendLine("CodeTrackr is active.");

    const tracker = new CodeTrackrTracker(logger, context);

    // Initial load
    tracker.reinitStatusBar();
    tracker.onEvent(false);
    tracker.refreshStats();

    // Command to show log
    context.subscriptions.push(vscode.commands.registerCommand('codetrackr-vscode.showLog', () => {
        logger.show();
    }));

    // Command to open dashboard
    context.subscriptions.push(vscode.commands.registerCommand('codetrackr-vscode.openDashboard', () => {
        const config = vscode.workspace.getConfiguration('codetrackr');
        const baseUrl = config.get<string>('baseUrl') || "https://codetrackr.leapcell.app";
        vscode.env.openExternal(vscode.Uri.parse(`${baseUrl.replace(/\/$/, '')}/dashboard`));
    }));

    // Command to enter API Key
    context.subscriptions.push(vscode.commands.registerCommand('codetrackr-vscode.enterToken', async () => {
        const config = vscode.workspace.getConfiguration('codetrackr');
        const currentApiKey = config.get<string>('apiKey') || "";
        
        const apiKey = await vscode.window.showInputBox({
            prompt: "Pega tu API Key de CodeTrackr (ej: ct_xxxxxxxxxxxxxxxxxxxx)",
            placeHolder: "ct_...",
            value: currentApiKey.startsWith("ct_") ? currentApiKey : "",
            ignoreFocusOut: true,
            password: true
        });

        if (apiKey !== undefined) {
            const cleanKey = apiKey.trim().replace(/[^\x00-\x7F]/g, ""); // Limpia caracteres extraños
            await config.update('apiKey', cleanKey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage("API Key de CodeTrackr actualizada.");
            tracker.onEvent(false);
            tracker.refreshStats();
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('codetrackr-vscode.setStatusBarStyle', async () => {
        const config = vscode.workspace.getConfiguration('codetrackr');
        const options: string[] = ["Today", "24h", "Total", "None"];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: "Selecciona qué ver en la barra de estado"
        });

        if (selected) {
            await config.update('statusBarStyle', selected, vscode.ConfigurationTarget.Global);
            tracker.refreshStats();
        }
    }));

    // Command to change Status Bar Alignment
    context.subscriptions.push(vscode.commands.registerCommand('codetrackr-vscode.statusBarAlignment', async () => {
        const config = vscode.workspace.getConfiguration('codetrackr');
        const options: string[] = ["Left", "Right"];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: "Selecciona el lado de la barra de estado"
        });

        if (selected) {
            await config.update('statusBarAlignment', selected, vscode.ConfigurationTarget.Global);
            tracker.reinitStatusBar();
        }
    }));

    // Event listeners
    const subscriptions = [
        vscode.window.onDidChangeActiveTextEditor(() => tracker.onEvent(false)),
        vscode.workspace.onDidChangeTextDocument(() => tracker.onEvent(false)),
        vscode.workspace.onDidSaveTextDocument(() => tracker.onEvent(true)),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('codetrackr.apiKey') || e.affectsConfiguration('codetrackr.baseUrl') || e.affectsConfiguration('codetrackr.statusBarStyle')) {
                tracker.onEvent(false);
                tracker.refreshStats();
            }
            if (e.affectsConfiguration('codetrackr.statusBarAlignment')) {
                tracker.reinitStatusBar();
            }
        })
    ];

    context.subscriptions.push(...subscriptions);
}

class CodeTrackrTracker {
    private lastSentTime: number = 0;
    private lastSentFile: string = "";
    private readonly heartBeatThrottleMS = 120000;
    private statsRefreshInterval: NodeJS.Timeout | null = null;
    private currentStatsText: string = "";
    private statusBar: vscode.StatusBarItem | null = null;

    constructor(
        private logger: vscode.OutputChannel,
        private context: vscode.ExtensionContext
    ) {
        this.statsRefreshInterval = setInterval(() => this.refreshStats(), 300000);
    }

    public reinitStatusBar() {
        if (this.statusBar) {
            this.statusBar.dispose();
        }

        const config = vscode.workspace.getConfiguration('codetrackr');
        const alignmentStr = config.get<string>('statusBarAlignment') || 'Right';
        const alignment = alignmentStr === 'Left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

        this.statusBar = vscode.window.createStatusBarItem(alignment, 100);
        this.statusBar.text = "$(clock) CodeTrackr";
        this.statusBar.tooltip = "Initializing...";
        this.statusBar.show();
        this.context.subscriptions.push(this.statusBar);
        
        // Mantener el estado actual si lo hay
        this.updateStatusBarUI();
    }

    private getSaneApiKey(): string {
        const config = vscode.workspace.getConfiguration('codetrackr');
        const key = config.get<string>('apiKey') || "";
        return key.trim().replace(/[^\x00-\x7F]/g, ""); // Limpia puntos invisibles, etc.
    }

    public async onEvent(isWrite: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document || editor.document.uri.scheme !== 'file') {
            return;
        }

        const fileName = editor.document.fileName;
        const now = Date.now();

        if (isWrite || now - this.lastSentTime > this.heartBeatThrottleMS || fileName !== this.lastSentFile) {
            await this.sendHeartbeat(editor.document, isWrite);
        }
    }

    public async refreshStats() {
        const apiKey = this.getSaneApiKey();
        const config = vscode.workspace.getConfiguration('codetrackr');
        const baseUrl = (config.get<string>('baseUrl') || "https://codetrackr.leapcell.app").trim();
        const style = config.get<string>('statusBarStyle') || "Today";

        if (!apiKey || style === "None" || apiKey === "ct_xxxxxxxxxxxxxxxxxxxx") {
            this.currentStatsText = "";
            this.updateStatusBarUI();
            return;
        }

        let params = "";
        if (style === "Total") {
            params = "range=all";
        } else if (style === "Today") {
            params = `start=${new Date().toISOString().split('T')[0]}T00:00:00Z`;
        } else if (style === "24h") {
            params = `start=${new Date(Date.now() - 86400000).toISOString()}`;
        }

        try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/stats/summary?${params}`, {
                headers: { "X-API-Key": apiKey } // USANDO API KEY SANEADA
            });

            if (response.ok) {
                const data: any = await response.json();
                this.currentStatsText = this.formatSeconds(data.total_seconds || 0);
            }
        } catch (e: any) {
            this.logger.appendLine(`Error refreshing stats: ${e.message}`);
        }
        this.updateStatusBarUI();
    }

    private formatSeconds(s: number): string {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${h}h ${m}m`;
    }

    public updateStatusBarUI() {
        if (!this.statusBar) {
            return;
        }

        const project = vscode.workspace.name || "Unknown";
        const stats = this.currentStatsText ? ` (${this.currentStatsText})` : "";
        
        // Conservar estados de error si existen
        if (!this.statusBar.text.includes("$(")) {
             this.statusBar.text = `$(check) CodeTrackr: ${project}${stats}`;
        }
        
        // Si no tenemos API Key configurada todavía
        const apiKey = this.getSaneApiKey();
        if (!apiKey || apiKey === "ct_xxxxxxxxxxxxxxxxxxxx") {
            this.statusBar.text = "$(warning) CodeTrackr: Configurar API Key";
            this.statusBar.command = "codetrackr-vscode.enterToken";
        }
    }

    private async sendHeartbeat(doc: vscode.TextDocument, isWrite: boolean) {
        if (!this.statusBar) {
            return;
        }
        
        const apiKey = this.getSaneApiKey();
        const baseUrl = (vscode.workspace.getConfiguration('codetrackr').get<string>('baseUrl') || "https://codetrackr.leapcell.app").trim();

        if (!apiKey || apiKey === "ct_xxxxxxxxxxxxxxxxxxxx") {
            this.updateStatusBarUI();
            return;
        }

        const project = vscode.workspace.name || "Unknown Project";
        const file = vscode.workspace.asRelativePath(doc.uri);
        const language = doc.languageId;
        const now = Date.now();

        let branch = "";
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.isActive) {
                const api = gitExtension.exports.getAPI(1);
                const repo = api.repositories.find((r: any) => doc.uri.fsPath.startsWith(r.rootUri.fsPath));
                branch = repo?.state?.HEAD?.name || "";
            }
        } catch (e) {}

        const payload = { project, file, lang: language, branch, editor: "VS Code", os: os.platform(), duration: 60, is_write: isWrite, time: Math.floor(now / 1000) };

        try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.lastSentTime = now;
                this.lastSentFile = doc.fileName;
                const stats = this.currentStatsText ? ` (${this.currentStatsText})` : "";
                this.statusBar.text = `$(check) CodeTrackr: ${project}${stats}`;
                this.statusBar.command = "codetrackr-vscode.openDashboard";
                this.logger.appendLine(`Heartbeat sent: ${file}`);
            } else {
                this.statusBar.text = "$(error) CodeTrackr: Error API";
                this.statusBar.command = "codetrackr-vscode.showLog";
            }
        } catch (e: any) {
            this.statusBar.text = "$(error) CodeTrackr: Error Conexión";
            this.logger.appendLine(`Network error: ${e.message}`);
        }
    }
}

export function deactivate() {}
