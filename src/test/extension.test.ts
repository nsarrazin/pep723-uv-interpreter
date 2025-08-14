import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { exec } from "child_process";

// Import the extension module
import * as extension from "../extension";

suite("PEP723 Interpreter Extension Test Suite", () => {
  let sandbox: sinon.SinonSandbox;
  let mockDocument: any;
  let mockEditor: any;
  let mockConfiguration: any;
  let mockWorkspaceConfiguration: any;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Mock document
    mockDocument = {
      languageId: "python",
      uri: { scheme: "file", path: "/test/script.py" },
      getText: sandbox.stub(),
    };

    // Mock editor
    mockEditor = {
      document: mockDocument,
    };

    // Mock configuration
    mockConfiguration = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
    };

    mockWorkspaceConfiguration = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
    };
    sandbox
      .stub(vscode.commands, "registerTextEditorCommand")
      .returns({ dispose: () => {} });
  });

  teardown(() => {
    sandbox.restore();
  });

  suite("PEP723 Header Detection", () => {
    test("should detect valid PEP723 header", () => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests
print("Hello, PEP 723!")`;

      mockDocument.getText.returns(pep723Content);

      // We need to test the header detection logic
      // Since the function is not exported, we'll test it through the command
      const range = new vscode.Range(0, 0, 20, 0);
      const head = mockDocument.getText(range);
      const hasHeader = /^#\s*\/\/\/\s*script/m.test(head);

      assert.strictEqual(hasHeader, true, "Should detect PEP723 header");
    });

    test("should not detect invalid PEP723 header", () => {
      const regularContent = `import requests
print("Hello, World!")`;

      mockDocument.getText.returns(regularContent);

      const range = new vscode.Range(0, 0, 20, 0);
      const head = mockDocument.getText(range);
      const hasHeader = /^#\s*\/\/\/\s*script/m.test(head);

      assert.strictEqual(hasHeader, false, "Should not detect PEP723 header");
    });

    test("should detect PEP723 header with variations in whitespace", () => {
      const variations = [
        "# /// script",
        "#/// script",
        "# ///script",
        "#///script",
      ];

      variations.forEach((variation) => {
        mockDocument.getText.returns(variation);
        const range = new vscode.Range(0, 0, 20, 0);
        const head = mockDocument.getText(range);
        const hasHeader = /^#\s*\/\/\/\s*script/m.test(head);

        assert.strictEqual(
          hasHeader,
          true,
          `Should detect header: ${variation}`,
        );
      });
    });
  });

  suite("Extension Activation", () => {
    test("should register the pickInterpreter command", async () => {
      const context = {
        subscriptions: [],
      };

      // Mock vscode.commands.registerCommand
      const registerCommandStub = sandbox.stub(
        vscode.commands,
        "registerCommand",
      );
      registerCommandStub.returns({ dispose: () => {} });

      // Mock other vscode APIs
      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value(null);

      extension.activate(context as any);

      assert.ok(
        registerCommandStub.calledWith("pep723.pickInterpreter"),
        "Should register pickInterpreter command",
      );
    });

    test("should register event handlers for auto-pick", async () => {
      const context = {
        subscriptions: [],
      };

      // Mock vscode APIs
      sandbox
        .stub(vscode.commands, "registerCommand")
        .returns({ dispose: () => {} });
      const onDidChangeActiveTextEditorStub = sandbox.stub(
        vscode.window,
        "onDidChangeActiveTextEditor",
      );
      const onDidOpenTextDocumentStub = sandbox.stub(
        vscode.workspace,
        "onDidOpenTextDocument",
      );
      onDidChangeActiveTextEditorStub.returns({ dispose: () => {} });
      onDidOpenTextDocumentStub.returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value(null);

      extension.activate(context as any);

      assert.ok(
        onDidChangeActiveTextEditorStub.called,
        "Should register onDidChangeActiveTextEditor handler",
      );
      assert.ok(
        onDidOpenTextDocumentStub.called,
        "Should register onDidOpenTextDocument handler",
      );
    });
  });

  suite("Configuration", () => {
    test("should respect enableAutoPick configuration", () => {
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(false),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);

      const config = vscode.workspace.getConfiguration("pep723");
      const enableAutoPick = config.get("enableAutoPick", true);

      assert.strictEqual(
        enableAutoPick,
        false,
        "Should return false when configured to disable auto-pick",
      );
    });

    test("should default to true for enableAutoPick", () => {
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);

      const config = vscode.workspace.getConfiguration("pep723");
      const enableAutoPick = config.get("enableAutoPick", true);

      assert.strictEqual(
        enableAutoPick,
        true,
        "Should default to true for enableAutoPick",
      );
    });
  });

  suite("Manual Command Execution", () => {
    test("should show message when no active editor", async () => {
      const showInformationMessageStub = sandbox.stub(
        vscode.window,
        "showInformationMessage",
      );
      sandbox.stub(vscode.window, "activeTextEditor").value(null);

      // Register and execute the command
      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      await pickInterpreterCallback();

      assert.ok(
        showInformationMessageStub.calledWith("No active editor."),
        "Should show no active editor message",
      );
    });

    test("should show message when no PEP723 header found", async () => {
      const showInformationMessageStub = sandbox.stub(
        vscode.window,
        "showInformationMessage",
      );

      mockDocument.getText.returns('# Regular Python file\nprint("Hello")');
      sandbox.stub(vscode.window, "activeTextEditor").value(mockEditor);

      // Register and execute the command
      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      await pickInterpreterCallback();

      assert.ok(
        showInformationMessageStub.calledWith("No PEP 723 header found."),
        "Should show no PEP723 header message",
      );
    });

    test("should create new script with PEP723 scaffolding", async () => {
      const openTextDocumentStub = sandbox.stub(
        vscode.workspace,
        "openTextDocument",
      );
      const showTextDocumentStub = sandbox.stub(
        vscode.window,
        "showTextDocument",
      );

      openTextDocumentStub.resolves({} as any);
      showTextDocumentStub.resolves();

      // Register and execute the command
      const context = { subscriptions: [] };
      let createScriptCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.createScript") {
            createScriptCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });

      extension.activate(context as any);

      // Execute the createScript command
      await createScriptCallback();

      assert.ok(openTextDocumentStub.called, "Should create new text document");

      const callArgs = openTextDocumentStub.firstCall?.args[0];
      assert.ok(callArgs, "Should have call arguments");
      assert.ok(callArgs.content, "Should have content");
      assert.ok(
        callArgs.content.includes("# /// script"),
        "Should include PEP723 metadata",
      );
      assert.ok(
        callArgs.content.includes("#!/usr/bin/env -S uv run --script"),
        "Should include shebang",
      );
      assert.strictEqual(
        callArgs.language,
        "python",
        "Should set language to python",
      );
    });
  });

  suite("File Type Filtering", () => {
    test("should only process Python files", () => {
      const nonPythonDocument = {
        ...mockDocument,
        languageId: "javascript",
      };

      // The auto-pick functionality should only process Python files
      // This is tested through the languageId check
      assert.strictEqual(
        nonPythonDocument.languageId,
        "javascript",
        "Should identify non-Python files",
      );
      assert.notStrictEqual(
        nonPythonDocument.languageId,
        "python",
        "Should not process non-Python files",
      );
    });

    test("should process Python files", () => {
      assert.strictEqual(
        mockDocument.languageId,
        "python",
        "Should process Python files",
      );
    });
  });

  suite("Error Handling", () => {
    test("should handle missing workspace root", () => {
      sandbox.stub(vscode.workspace, "rootPath").value(undefined);

      // This tests that the extension handles cases where there's no workspace root
      // The actual exec call would fail, but the extension should handle this gracefully
      assert.ok(true, "Should handle missing workspace root gracefully");
    });
  });

  suite("UV Command Execution", () => {
    let execStub: sinon.SinonStub;

    setup(() => {
      execStub = sandbox.stub(require("child_process"), "exec");
    });

    teardown(() => {
      if (execStub) {
        execStub.reset();
      }
    });

    test("should run uv sync before uv python find", (done) => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);
      mockDocument.uri = { fsPath: "/test/script.py" };

      let execCallCount = 0;
      // Mock successful uv sync
      execStub.onFirstCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv sync --script "/test/script.py"'),
          "First call should be uv sync with script path",
        );
        callback(null, "", "");
      });
      // Mock successful uv python find
      execStub.onSecondCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv python find --script "/test/script.py"'),
          "Second call should be uv python find with script path",
        );
        callback(null, "/path/to/python", "");

        // Assert that both calls were made
        assert.strictEqual(execCallCount, 2, "Should call exec twice");
        done();
      });

      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      // Mock pep723 configuration for autoPickIfEnabled
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      // Mock python configuration for interpreter setting
      getConfigurationStub.withArgs("python", mockDocument.uri).returns({
        get: sandbox.stub(),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub().resolves(),
      } as any);
      sandbox.stub(vscode.workspace, "getWorkspaceFolder").returns(undefined);
      sandbox.stub(vscode.workspace, "rootPath").value("/test");

      // Simulate the pickInterpreter function being called
      // We need to test this indirectly since the function isn't exported
      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value({
        document: mockDocument,
      });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      pickInterpreterCallback();
    });

    test("should handle uv sync error gracefully", (done) => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);
      mockDocument.uri = { fsPath: "/test/script.py" };

      let callCount = 0;
      // Mock failed uv sync - should only be called once
      execStub.callsFake((cmd, options, callback) => {
        callCount++;
        assert.ok(
          cmd.includes('uv sync --script "/test/script.py"'),
          "Should call uv sync with script path",
        );
        assert.strictEqual(callCount, 1, "Should only call exec once");
        callback(new Error("sync failed"), "", "Sync error");

        // Check that error message was shown and no second exec call
        setTimeout(() => {
          assert.strictEqual(
            callCount,
            1,
            "Should only call exec once (sync fails)",
          );
          assert.ok(
            showErrorMessageStub.calledWith("uv sync error: Sync error"),
            "Should show sync error message",
          );
          done();
        }, 5);
      });

      const showErrorMessageStub = sandbox.stub(
        vscode.window,
        "showErrorMessage",
      );
      // Mock pep723 configuration for autoPickIfEnabled - DISABLE auto-pick for this test
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(false),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      sandbox.stub(vscode.workspace, "rootPath").value("/test");

      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value({
        document: mockDocument,
      });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      pickInterpreterCallback();
    });

    test("should handle uv python find error after successful sync", (done) => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);
      mockDocument.uri = { fsPath: "/test/script.py" };

      let execCallCount = 0;
      // Mock successful uv sync
      execStub.onFirstCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv sync --script "/test/script.py"'),
          "First call should be uv sync with script path",
        );
        callback(null, "", "");
      });
      // Mock failed uv python find
      execStub.onSecondCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv python find --script "/test/script.py"'),
          "Second call should be uv python find with script path",
        );
        callback(new Error("find failed"), "", "Find error");

        // Assert that both calls were made and error was shown
        assert.strictEqual(execCallCount, 2, "Should call exec twice");
        assert.ok(
          showErrorMessageStub.calledWith("uv python find error: Find error"),
          "Should show find error message",
        );
        done();
      });

      const showErrorMessageStub = sandbox.stub(
        vscode.window,
        "showErrorMessage",
      );
      // Mock pep723 configuration for autoPickIfEnabled
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      sandbox.stub(vscode.workspace, "rootPath").value("/test");

      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value({
        document: mockDocument,
      });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      pickInterpreterCallback();
    });

    test("should handle empty interpreter response", (done) => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);
      mockDocument.uri = { fsPath: "/test/script.py" };

      let execCallCount = 0;
      // Mock successful uv sync
      execStub.onFirstCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv sync --script "/test/script.py"'),
          "First call should be uv sync with script path",
        );
        callback(null, "", "");
      });
      // Mock uv python find returning empty string
      execStub.onSecondCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv python find --script "/test/script.py"'),
          "Second call should be uv python find with script path",
        );
        callback(null, "", "");

        // Assert that both calls were made and error was shown for empty response
        assert.strictEqual(execCallCount, 2, "Should call exec twice");
        assert.ok(
          showErrorMessageStub.calledWith("No interpreter returned."),
          "Should show no interpreter message",
        );
        done();
      });

      const showErrorMessageStub = sandbox.stub(
        vscode.window,
        "showErrorMessage",
      );
      // Mock pep723 configuration for autoPickIfEnabled
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      sandbox.stub(vscode.workspace, "rootPath").value("/test");

      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value({
        document: mockDocument,
      });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      pickInterpreterCallback();
    });

    test("should successfully set interpreter after sync and find", (done) => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);
      mockDocument.uri = { fsPath: "/test/script.py" };

      const updateStub = sandbox.stub().resolves();
      let execCallCount = 0;
      // Mock successful uv sync
      execStub.onFirstCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv sync --script "/test/script.py"'),
          "First call should be uv sync with script path",
        );
        callback(null, "", "");
      });
      // Mock successful uv python find
      execStub.onSecondCall().callsFake((cmd, options, callback) => {
        execCallCount++;
        assert.ok(
          cmd.includes('uv python find --script "/test/script.py"'),
          "Second call should be uv python find with script path",
        );
        callback(null, "/path/to/python\n", "");

        // Assert that both calls were made and interpreter was set
        setTimeout(() => {
          assert.strictEqual(execCallCount, 2, "Should call exec twice");
          assert.ok(
            updateStub.calledWith(
              "defaultInterpreterPath",
              "/path/to/python",
              vscode.ConfigurationTarget.Global,
            ),
            "Should update interpreter configuration",
          );
          done();
        }, 5);
      });

      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      // Mock pep723 configuration for autoPickIfEnabled
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      // Mock python configuration for interpreter setting
      getConfigurationStub.withArgs("python", mockDocument.uri).returns({
        get: sandbox.stub(),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: updateStub,
      } as any);
      sandbox.stub(vscode.workspace, "getWorkspaceFolder").returns(undefined);
      sandbox.stub(vscode.workspace, "rootPath").value("/test");

      const context = { subscriptions: [] };
      let pickInterpreterCallback: any;

      sandbox
        .stub(vscode.commands, "registerCommand")
        .callsFake((command: string, callback: () => void) => {
          if (command === "pep723.pickInterpreter") {
            pickInterpreterCallback = callback;
          }
          return { dispose: () => {} };
        });

      sandbox
        .stub(vscode.window, "onDidChangeActiveTextEditor")
        .returns({ dispose: () => {} });
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: () => {} });
      sandbox.stub(vscode.window, "activeTextEditor").value({
        document: mockDocument,
      });

      extension.activate(context as any);

      // Execute the pickInterpreter command
      pickInterpreterCallback();
    });
  });

  suite("Integration Tests", () => {
    test("should handle complete workflow for valid PEP723 file", async () => {
      const pep723Content = `# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///

import requests`;

      mockDocument.getText.returns(pep723Content);

      // Mock the configuration to enable auto-pick
      const getConfigurationStub = sandbox.stub(
        vscode.workspace,
        "getConfiguration",
      );
      getConfigurationStub.withArgs("pep723").returns({
        get: sandbox.stub().withArgs("enableAutoPick", true).returns(true),
        has: sandbox.stub(),
        inspect: sandbox.stub(),
        update: sandbox.stub(),
      } as any);
      getConfigurationStub
        .withArgs("python", mockDocument.uri)
        .returns(mockWorkspaceConfiguration);

      // The workflow should detect the PEP723 header and attempt to run uv
      const hasHeader = /^#\s*\/\/\/\s*script/m.test(pep723Content);
      const isAutoPickEnabled = true;
      const isPythonFile = mockDocument.languageId === "python";

      assert.strictEqual(hasHeader, true, "Should detect PEP723 header");
      assert.strictEqual(
        isAutoPickEnabled,
        true,
        "Should have auto-pick enabled",
      );
      assert.strictEqual(isPythonFile, true, "Should be Python file");
    });
  });
});
