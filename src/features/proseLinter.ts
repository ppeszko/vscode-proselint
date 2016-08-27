'use strict';

import * as vscode from 'vscode';
import * as shelljs from 'shelljs';

interface Error {
    check: string
    line: number
    column: number
    start: number
    end: number
    extent: number
    message: string
    severity: vscode.DiagnosticSeverity
}

export default class ProseLinter implements vscode.CodeActionProvider {
    diagnostics: vscode.DiagnosticCollection;
    statusBarItem: vscode.StatusBarItem;
    disabled: boolean = false;

    public activate(context: vscode.ExtensionContext) {
        let subscriptions: vscode.Disposable[] = context.subscriptions
        this.diagnostics = vscode.languages.createDiagnosticCollection("ProseLinter");

        vscode.commands.registerCommand("toggleChecking", this.toggleChecking.bind(this));
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -100);
        this.statusBarItem.command = "toggleChecking";
        this.statusBarItem.tooltip = "Toggles ProseLint of/off";
        this.statusBarItem.show();
        this._updateStatusBar();

        subscriptions.push(this);

        vscode.workspace.onDidSaveTextDocument((textDocument) => {
            this.checkDocument(textDocument);
        }, this, subscriptions);

        vscode.workspace.onDidCloseTextDocument((textDocument) => {
            this.diagnostics.clear();
        }, this, subscriptions);

    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.Command[] {
        return [];
    }

    public checkDocument(document: vscode.TextDocument = vscode.window.activeTextEditor.document) {
        shelljs.exec(`proselint --json ${document.fileName}`, (code, output, error) => {
            this.proseLintResult(document, code, output, error);
        });
    }

    public toggleChecking() {
        if (this.disabled) {
            this.checkDocument();
        } else {
            this.diagnostics.clear();
        }

        this.disabled = !this.disabled;
        this._updateStatusBar();
    }

    public proseLintResult(document: vscode.TextDocument, code: number, output: string, error?: string): any {
        this.diagnostics.clear();
        if (error) {
            vscode.window.showErrorMessage(error);
        } else {
            let {data} = JSON.parse(output);
            let errors = data.errors;
            let linterErrors = this._parseErrors(errors);
            this._presentLinterErrors(document, linterErrors);
        }
    }

    private _parseErrors(jsonErrors): Error[] {
        let linterErrors: Error[] = []

        for (let error of jsonErrors) {
            let severity: vscode.DiagnosticSeverity;

            switch (error.severity) {
                case "error":
                    severity = vscode.DiagnosticSeverity.Error;
                    break;
                case "warning":
                    severity = vscode.DiagnosticSeverity.Warning;
                    break;
                case "suggestion":
                    severity = vscode.DiagnosticSeverity.Hint;
                    break;
                default:
                    severity = vscode.DiagnosticSeverity.Error;
            }
            console.log(error.severity);

            let linterError = {
                message: error.message as string,
                check: error.check as string,
                line: error.line - 1 as number,
                column: error.column - 1 as number,
                start: error.start - 2 as number,
                end: error.end - 1 as number,
                extent: error.extent as number,
                severity: severity
            };
            linterErrors.push(linterError);
        }

        return linterErrors;
    }

    private _presentLinterErrors(document: vscode.TextDocument, errors: Error[]): void {
        let newDiagnostics: vscode.Diagnostic[] = []
        for (let error of errors) {
            let range = new vscode.Range(error.line, error.start, error.line, error.end);
            let diagnostic = new vscode.Diagnostic(range, error.message);
            diagnostic.severity = error.severity;
            newDiagnostics.push(diagnostic);
        }

        this.diagnostics.set(document.uri, newDiagnostics);
    }

    private _updateStatusBar() {
        if (this.disabled) {
            this.statusBarItem.text = "Proselint Disabled";
            this.statusBarItem.color = "orange";
        } else {
            this.statusBarItem.text = "Proselint Enabled";
            this.statusBarItem.color = "white";
        }
    }

    public dispose() {
        this.diagnostics.clear();
        this.diagnostics.dispose();
        this.statusBarItem.dispose();
    }

}

