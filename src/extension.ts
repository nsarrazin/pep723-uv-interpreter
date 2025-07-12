// src/extension.ts
import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";

function hasPEP723Header(document: vscode.TextDocument): boolean {
  // only check first 20 lines
  const head = document.getText(new vscode.Range(0, 0, 20, 0));
  return /^#\s*\/\/\/\s*script/m.test(head);
}

function createNewScript(): void {
  const template = `#!/usr/bin/env -S uv run --script
# -*- coding: utf-8 -*-
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "click",
# ]
# ///

import sys
import click

@click.command()
@click.option('--name', default='World', help='Name to greet')
def hello(name: str):
    """Simple program that greets NAME."""
    click.echo(f'Hello, {name}!')


if __name__ == '__main__':
    hello()
`;

  // Create a new untitled document
  vscode.workspace
    .openTextDocument({
      content: template,
      language: "python",
    })
    .then(
      (doc) => {
        vscode.window.showTextDocument(doc);
      },
      (err) => {
        vscode.window.showErrorMessage(`Failed to create new script: ${err}`);
      }
    );
}

function pickInterpreter(document: vscode.TextDocument): void {
  // Only process Python files
  if (document.languageId !== "python") {
    return;
  }

  if (!hasPEP723Header(document)) {
    return;
  }

  // Get the file path for the current document
  const filePath = document.uri.fsPath;

  // run uv to find the interpreter for this specific script
  exec(
    `uv python find --script "${filePath}"`,
    { cwd: vscode.workspace.rootPath },
    (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`uv error: ${stderr || err.message}`);
        return;
      }
      const interp = stdout.trim();
      if (!interp) {
        vscode.window.showErrorMessage("No interpreter returned.");
        return;
      }

      // Determine the appropriate configuration target
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      const configTarget = workspaceFolder
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Global;

      // Update the workspace or global setting
      const cfg = vscode.workspace.getConfiguration("python", document.uri);
      cfg.update("defaultInterpreterPath", interp, configTarget).then(
        () => {
          const scope = workspaceFolder ? "workspace" : "global";
        },
        (e) => {
          vscode.window.showErrorMessage(`Failed to set interpreter: ${e}`);
        }
      );
    }
  );
}

export function activate(ctx: vscode.ExtensionContext) {
  // Register the manual command
  const disposable = vscode.commands.registerCommand(
    "pep723.pickInterpreter",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
      }

      const doc = editor.document;
      if (doc.languageId !== "python") {
        vscode.window.showInformationMessage(
          "This command only works with Python files."
        );
        return;
      }

      if (!hasPEP723Header(doc)) {
        vscode.window.showInformationMessage("No PEP 723 header found.");
        return;
      }

      pickInterpreter(doc);
    }
  );

  // Register the create script command
  const createScriptDisposable = vscode.commands.registerCommand(
    "pep723.createScript",
    createNewScript
  );

  ctx.subscriptions.push(disposable);
  ctx.subscriptions.push(createScriptDisposable);

  // Auto-pick functionality
  function autoPickIfEnabled(document: vscode.TextDocument): void {
    if (!document || document.languageId !== "python") {
      return;
    }

    const config = vscode.workspace.getConfiguration("pep723");
    const enableAutoPick = config.get<boolean>("enableAutoPick", true);

    if (enableAutoPick) {
      pickInterpreter(document);
    }
  }

  // Handle file open and editor switching
  ctx.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        autoPickIfEnabled(editor.document);
      }
    })
  );

  // Handle when documents are opened
  ctx.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      autoPickIfEnabled(document);
    })
  );

  // Check the current active editor when extension activates
  if (vscode.window.activeTextEditor) {
    autoPickIfEnabled(vscode.window.activeTextEditor.document);
  }
}

export function deactivate() {}
