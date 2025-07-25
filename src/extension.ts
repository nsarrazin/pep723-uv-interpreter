// src/extension.ts
import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";

function hasPEP723Header(document: vscode.TextDocument): boolean {
  // only check first 20 lines
  const head = document.getText(new vscode.Range(0, 0, 20, 0));
  return /^#\s*\/\/\/\s*script/m.test(head);
}

/**
 * Return true is the given position is inside a PEP 723 inline-script block.
 *
 * For the sake of user-friendliness, we allow some invalid syntax inside the
 * block. For more information on how the inline script block is defined, see:
 * https://packaging.python.org/en/latest/specifications/inline-script-metadata/#inline-script-metadata
 */
function isInsidePEP723Block(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  // Exit early if the current line is not a comment line to avoid slowing down the editor.
  // Do this check first because it is the most common case and avoids checking the top 20 lines.
  if (!document.lineAt(position.line).text.trim().startsWith("#")) {
    return false;
  }
  // Early exit if no PEP 723 header
  if (!hasPEP723Header(document)) {
    return false;
  }

  let insideBlock = false;
  for (let i = 0; i <= position.line; i++) {
    const line = document.lineAt(i).text;
    // Start of script block
    if (/^#\s*\/\/\/\s*script\s*$/.test(line)) {
      insideBlock = true;
    }
    // We have exited the script block if there is a non-comment or non-whitespace line or we have
    // reached the end of the script block. Since there is only one script block, we can exit early.
    else if (
      insideBlock &&
      (!/^#.*$/.test(line) || /^#\s*\/\/\/\s*$/.test(line))
    ) {
      return false;
    }
  }

  return insideBlock;
}

function getCommentPrefix(
  document: vscode.TextDocument,
  position: vscode.Position,
): string {
  const line = document.lineAt(position.line);
  const match = line.text.match(/^(\s*#\s*)/);
  return match ? match[1].substring(0, position.character) : "# ";
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
      },
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

  // First run uv sync to ensure the environment exists
  exec(
    `uv sync --script "${filePath}"`,
    { cwd: vscode.workspace.rootPath },
    (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(
          `uv sync error: ${stderr || err.message}`,
        );
        return;
      }

      // After sync, run uv python find to get the interpreter
      exec(
        `uv python find --script "${filePath}"`,
        { cwd: vscode.workspace.rootPath },
        (err, stdout, stderr) => {
          if (err) {
            vscode.window.showErrorMessage(
              `uv python find error: ${stderr || err.message}`,
            );
            return;
          }
          const interp = stdout.trim();
          if (!interp) {
            vscode.window.showErrorMessage("No interpreter returned.");
            return;
          }

          // Determine the appropriate configuration target
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            document.uri,
          );
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
            },
          );
        },
      );
    },
  );
}

function autoCommentBlock(
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit,
) {
  const document = textEditor.document;
  const position = textEditor.selection.active;
  const currentLine = document.lineAt(position.line);
  // Check if we're in a PEP 723 block and on a comment line
  if (
    !isInsidePEP723Block(document, position) ||
    !currentLine.text.match(/^\s*#/)
  ) {
    edit.insert(position, "\n");
    return;
  }
  // If the cursor is before the comment prefix, add the comment prefix before the newline
  const commentPrefix = getCommentPrefix(document, position);
  if (
    position.character <= currentLine.firstNonWhitespaceCharacterIndex &&
    currentLine.text.trim().startsWith(commentPrefix)
  ) {
    edit.insert(position, commentPrefix + "\n");
    return;
  }
  // Insert newline and comment prefix
  edit.insert(position, "\n" + commentPrefix);
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
          "This command only works with Python files.",
        );
        return;
      }

      if (!hasPEP723Header(doc)) {
        vscode.window.showInformationMessage("No PEP 723 header found.");
        return;
      }

      pickInterpreter(doc);
    },
  );

  // Register the create script command
  const createScriptDisposable = vscode.commands.registerCommand(
    "pep723.createScript",
    createNewScript,
  );

  // Register auto comment block command for PEP 723 blocks
  const autoCommentDisposable = vscode.commands.registerTextEditorCommand(
    "pep723.autoComment",
    (textEditor, edit, args) => {
      autoCommentBlock(textEditor, edit);
    },
  );

  ctx.subscriptions.push(disposable);
  ctx.subscriptions.push(createScriptDisposable);
  ctx.subscriptions.push(autoCommentDisposable);

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
    }),
  );

  // Handle when documents are opened
  ctx.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      autoPickIfEnabled(document);
    }),
  );

  // Check the current active editor when extension activates
  if (vscode.window.activeTextEditor) {
    autoPickIfEnabled(vscode.window.activeTextEditor.document);
  }
}

export function deactivate() {}
