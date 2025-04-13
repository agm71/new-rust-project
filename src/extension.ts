import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('new-rust-project.createProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        let workspaceRoot: string | undefined = undefined;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            const selectedFolderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                openLabel: 'Select folder to create the project folder in.',
                canSelectMany: false
            });

            if (!selectedFolderUri || selectedFolderUri.length === 0) {
                vscode.window.showErrorMessage('You need to select a folder to create the project folder in.');
                return;
            }

            workspaceRoot = selectedFolderUri[0].fsPath;
        } else {
            workspaceRoot = workspaceFolders[0].uri.fsPath;
        }

        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter a name for your Rust project',
            validateInput: text => text ? undefined : 'Project name cannot be empty'
        });

        if (!folderName) {
            vscode.window.showErrorMessage('Project name is required.');
            return;
        }

		const projectType = await vscode.window.showQuickPick(['Console Application', 'Library'], {
            placeHolder: 'Choose project type:'
        });

		if (!projectType) {
            vscode.window.showErrorMessage('You must choose a project type.');
            return;
        }

        const projectPath = path.join(workspaceRoot, folderName);

		try {
            const cargoCommand = projectType === 'Library' ? 'cargo init --lib' : 'cargo init';
            execSync(`${cargoCommand} ${folderName}`, { cwd: workspaceRoot });
            vscode.window.showInformationMessage(`Rust ${projectType} '${folderName}' created successfully!`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to create project: ${err}`);
            return;
        }

        const addTasks = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Do you want to add tasks for Cargo build/run/check?'
        });

        const vscodeDir = path.join(projectPath, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        if (addTasks === 'Yes') {
            const tasks = {
                version: '2.0.0',
                tasks: [
					{
						"type": "cargo",
						"command": "build",
						"problemMatcher": [
							"$rustc"
						],
						"group": "build",
						"label": "cargo build",
						"presentation": {
							"reveal": "always",
							"focus": true,
							"panel":"shared",
							"clear": true
						  }
					},
					{
						"label": "cargo run", 
						"type": "shell",
						"command": "cargo",
						"args": ["run"],
						"group": "build",
						"problemMatcher": [],
						"presentation": {
							"reveal": "always",
							"focus": true,
							"panel":"shared",
							"clear": true
						  }
					},
					{
						"label": "cargo check", 
						"type": "shell",
						"command": "cargo",
						"args": ["check"],
						"problemMatcher": [
							"$rustc"
						],
						"presentation": {
							"reveal": "always",
							"focus": true,
							"panel":"shared",
							"clear": true
						  }
					},		
					{
						"label": "clear terminal",
						"type": "shell",
						"command": "cls",
						"problemMatcher": [],
						"presentation": {
						  "reveal": "always",
						  "focus": false,
						  "panel": "shared",
						  "clear": true
						}
					  }
                ]
            };

            fs.writeFileSync(path.join(vscodeDir, 'tasks.json'), JSON.stringify(tasks, null, 4));
        }

        const addKeybindings = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Do you want to add keyboard shortcuts to keybindings.json (Ctrl+F5 = Cargo Run, Ctrl+Shift+B = Cargo Build, Ctrl+Shift+C = Cargo Check) ?'
        });

		if (addKeybindings === 'Yes') {
            const newKeybindings = [
				{
					"key": "ctrl+shift+b",
					"command": "workbench.action.tasks.runTask",
					"args": "cargo build"
				},
				{
				  "key": "ctrl+shift+c",
				  "command": "workbench.action.tasks.runTask",
				  "args": "cargo check"
				},
				{
				  "key": "ctrl+f5",
				  "command": "workbench.action.tasks.runTask",
				  "args": "cargo run"
				}
            ];

            let keybindingsPath = '';
            if (os.platform() === 'win32') {
                keybindingsPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'keybindings.json');
            } else if (os.platform() === 'darwin') {
                keybindingsPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Code', 'User', 'keybindings.json');
            } else {
                keybindingsPath = path.join(process.env.HOME || '', '.config', 'Code', 'User', 'keybindings.json');
            }

			writeKeybindings(keybindingsPath, newKeybindings);
		}

        const addLaunchConfig = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Do you want to add a launch configuration that uses the Visual Studio Windows debugger?'
        });

		if (addLaunchConfig === 'Yes') {
            const launchConfig = {
                version: '0.2.0',
                configurations: [
                    {
						"name": "(Windows) Launch",
						"type": "cppvsdbg",
						"request": "launch",
						"program": "${workspaceRoot}/target/debug/${workspaceFolderBasename}.exe",
						"args": [],
						"stopAtEntry": false,
						"cwd": "${workspaceRoot}",
						"environment": [],
						"internalConsoleOptions": "openOnSessionStart",
						"console": "integratedTerminal",
						"preLaunchTask": "clear terminal",
                    }
                ]
            };

            fs.writeFileSync(path.join(vscodeDir, 'launch.json'), JSON.stringify(launchConfig, null, 4));
        }

        const uri = vscode.Uri.file(projectPath);
        vscode.commands.executeCommand('vscode.openFolder', uri, false);
    });

    context.subscriptions.push(disposable);
}

function writeKeybindings(keybindingsPath: string, newKeybindings: any[]) {
    try {
        if (!fs.existsSync(keybindingsPath)) {
            fs.writeFileSync(keybindingsPath, JSON.stringify([], null, 4));
            vscode.window.showInformationMessage(`Created keybindings.json at ${keybindingsPath}`);
        }

        const rawData = fs.readFileSync(keybindingsPath, 'utf8');
        const cleanedData = removeJsonComments(rawData);

        let existingKeybindings: any[] = [];

        try {
            existingKeybindings = JSON.parse(cleanedData);
        } catch (error) {
            vscode.window.showErrorMessage('Invalid keybindings.json file.');
            console.error(error);
            return;
        }

        let addedCount = 0;

        for (const newBinding of newKeybindings) {
            const exists = existingKeybindings.some(
                existing =>
                    existing.key === newBinding.key &&
                    existing.command === newBinding.command
            );

            if (!exists) {
                existingKeybindings.push(newBinding);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            fs.writeFileSync(keybindingsPath, JSON.stringify(existingKeybindings, null, 4));
            vscode.window.showInformationMessage(`${addedCount} keybinding(s) added.`);
        } else {
            vscode.window.showInformationMessage('No new keybindings were added. All already exist.');
        }

    } catch {
        vscode.window.showErrorMessage("Error updating keybindings.json");
    }
}

function removeJsonComments(json: string): string {
    let cleanedJson = json.replace(/\/\/[^\n]*\n/g, '\n');
    cleanedJson = cleanedJson.replace(/\/\*[\s\S]*?\*\//g, '');
    cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1'); 

    return cleanedJson;
}