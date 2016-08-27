'use strict';

import * as vscode from 'vscode';
import ProseLinter from './features/proseLinter';

export function activate(context: vscode.ExtensionContext) {
    let linter = new ProseLinter();
    linter.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
}