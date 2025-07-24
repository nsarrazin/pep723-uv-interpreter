# PEP723 Interpreter Picker

A Visual Studio Code extension that automatically discovers and sets the Python interpreter for PEP 723–style scripts (with `# /// script` headers) using `uv python find --script`.

### Features

- Detects PEP 723 script headers in Python files
- Runs `uv python find --script` to locate the appropriate interpreter
- Updates `python.defaultInterpreterPath` in your workspace folder settings
- Optionally auto-runs on file open or switching editors

### Prerequisites

- [uv](https://github.com/jaraco/uv) installed and on your `PATH`

> [!WARNING]
> You must run the script yourself once in order for `uv` to create the environment so the extension can find it. You also need to run the script when updating dependencies to ensure they get picked up.

### Installation

#### From the Marketplace

1. Open VS Code and go to the Extensions view (`Ctrl+Shift+X`).
2. Search for **PEP723 Interpreter Picker** and click **Install**.

#### From a VSIX

1. Download the `.vsix` file from the releases page.
2. In VS Code, open the Command Palette (`Ctrl+Shift+P`) and choose **Extensions: Install from VSIX...**
3. Select the downloaded file and install.

### Usage

1. Open or switch to a Python file containing a PEP 723 header, for example:

   ```python
   # /// script
   # requires-python = ">=3.11"
   # dependencies = ["requests"]
   # ///

   import requests
   print("Hello, PEP 723!")
   ```

2. The extension will automatically run `uv python find --script` in your workspace root.
3. It updates your workspace’s Python interpreter setting to the discovered path.

#### Manual Trigger

If you prefer not to auto-run, you can manually invoke the command:

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Run **PEP723: Pick Interpreter**.

### Configuration

- `pep723.enableAutoPick` (boolean, default `true`)
  - Enable or disable automatic interpreter picking on file open or switch.

### Development

1. Clone the repo:

   ```bash
   git clone https://github.com/your-name/pep723-interpreter.git
   cd pep723-interpreter
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile TypeScript:

   ```bash
   npm run compile
   ```

4. Open in VS Code and press `F5` to launch the Extension Development Host.

### Publishing

1. Update the version in `package.json`.
2. Log in with your publisher name:

   ```bash
   vsce login <publisher-name>
   ```

3. Publish:

   ```bash
   vsce publish
   ```

### Contributing

Contributions are welcome! Please open issues or submit pull requests for bug fixes and enhancements.

### License

MIT License. See [LICENSE](LICENSE) for details.
