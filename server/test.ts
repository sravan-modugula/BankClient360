import fs from 'node:fs';
import { execSync } from 'node:child_process';

// 1. Extract from package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allRootDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies
};

const processed = new Set();
let csvContent = "Package Name,Immediate Dependencies\n";

console.log("Resolving dependencies from remote registry... (this may take a minute)");

// 2. Look up dependencies for all
for (const name in allRootDeps) {
    if (processed.has(name)) continue;
    processed.add(name);

    try {
        // Fetch sub-dependencies remotely using npm view
        const output = execSync(`npm view ${name} dependencies --json`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        const subDepsObj = output ? JSON.parse(output) : {};
        const subDepsList = Object.keys(subDepsObj).join('; ');

        // Print unique dependencies in relevant cells
        csvContent += `"${name}","${subDepsList || 'None'}"\n`;
    } catch (e) {
        csvContent += `"${name}","Error fetching data"\n`;
    }
}

// Save the sheet
fs.writeFileSync('team_approval_sheet.csv', csvContent);
console.log("Done! Open 'team_approval_sheet.csv' to see the report.");
