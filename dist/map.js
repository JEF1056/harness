import * as fs from "fs";
import * as path from "path";
const MAX_TOKENS = 4000;
const MAX_CHARS = 16000;
const DEFAULT_EXCLUDES = ["node_modules", ".git", ".agents", "dist", "build", ".next", ".nuxt", ".output", "vendor", "target", "out"];
export const CODEBASE_MAP_PROMPT = `You are building a living codebase map. Your job is to create or update CODEBASE_MAP.md in the workspace root.

## Instructions
1. Traverse the workspace directory tree
2. Identify key files (package.json, tsconfig, docker-compose, Makefile, etc.)
3. Scan entry points (main files, bin files, routes)
4. Identify module boundaries and dependencies
5. Produce a structured markdown document following the template below

## Template
\`\`\`markdown
# Codebase Map

## Project Overview
- Language, framework, build system
- Entry points
- High-level architecture (text-based)

## Directory Structure
- Top-level directory tree with annotations
- Key modules and their responsibilities

## Module Deep-Dives
### [module-name]
- Purpose
- Key files
- Dependencies (internal + external)
- Data flow / call chains

## Key Interfaces & APIs
- Public APIs
- Internal interfaces
- Data models

## Configuration
- Build config files
- Environment variables
- CI/CD pipeline

## Recent Changes
- Last updated timestamp
- Summary of recent modifications

---
Last regenerated: [ISO timestamp]
\`\`\`

## Constraints
- Keep total document under ${MAX_TOKENS} tokens (~${MAX_CHARS} characters)
- Each module deep-dive capped at 500 tokens
- Directory structure: top 3 levels shown in full, deeper levels compressed to counts
- Recent Changes: keep only last 10 entries
- Use on-demand detail fetching for complex modules (store details in .agents/map_modules/<module-name>.md)
- Include token estimate header: <!-- tokens: overview=X, dir=X, modules=X, interfaces=X, config=X, changes=X -->
`;
export function build_codebase_map(workspaceRoot, options) {
    const excludeDirs = [...DEFAULT_EXCLUDES];
    const scope = options?.scope || null;
    // Build directory tree
    const dirTree = buildDirectoryTree(workspaceRoot, excludeDirs, scope);
    // Identify key files
    const keyFiles = identifyKeyFiles(workspaceRoot);
    // Identify entry points
    const entryPoints = identifyEntryPoints(workspaceRoot);
    // Identify modules
    const modules = identifyModules(workspaceRoot);
    // Build the document
    let doc = `# Codebase Map\n\n`;
    // Project Overview
    doc += `## Project Overview\n\n`;
    doc += `- **Language**: ${detectLanguage(workspaceRoot)}\n`;
    doc += `- **Framework**: ${detectFramework(workspaceRoot)}\n`;
    doc += `- **Build System**: ${detectBuildSystem(workspaceRoot)}\n`;
    doc += `- **Entry Points**: ${entryPoints.map(e => path.relative(workspaceRoot, e).replace(/\\/g, "/")).join(", ") || "None detected"}\n`;
    doc += `- **Architecture**: ${describeArchitecture(workspaceRoot, modules)}\n\n`;
    // Directory Structure
    doc += `## Directory Structure\n\n\`\`\`\n${dirTree}\n\`\`\`\n\n`;
    // Key Files
    if (keyFiles.length > 0) {
        doc += `## Key Files\n\n`;
        for (const kf of keyFiles.slice(0, 20)) {
            doc += `- \`${path.relative(workspaceRoot, kf).replace(/\\/g, "/")}\`\n`;
        }
        doc += `\n`;
    }
    // Module Deep-Dives
    if (modules.length > 0) {
        doc += `## Module Deep-Dives\n\n`;
        for (const mod of modules.slice(0, 5)) {
            doc += `### ${mod.name}\n\n`;
            doc += `- **Purpose**: ${mod.purpose}\n`;
            doc += `- **Key Files**: ${mod.keyFiles.map(f => `\`${path.relative(workspaceRoot, f).replace(/\\/g, "/")}\``).join(", ")}\n`;
            doc += `- **Dependencies**: ${mod.dependencies.join(", ") || "None"}\n\n`;
        }
    }
    // Recent Changes
    doc += `## Recent Changes\n\n`;
    doc += `- Last regenerated: ${new Date().toISOString()}\n`;
    doc += `- Scope: ${scope || "Full project"}\n\n`;
    // Token estimate header
    const tokenEstimate = estimateTokens(doc);
    doc = `<!-- tokens: overview=${Math.floor(tokenEstimate * 0.15)}, dir=${Math.floor(tokenEstimate * 0.25)}, modules=${Math.floor(tokenEstimate * 0.40)}, interfaces=${Math.floor(tokenEstimate * 0.10)}, config=${Math.floor(tokenEstimate * 0.05)}, changes=${Math.floor(tokenEstimate * 0.05)} -->\n` + doc;
    // Prune if over budget
    doc = prune(doc, { maxTokens: MAX_TOKENS, maxChars: MAX_CHARS });
    return doc;
}
function buildDirectoryTree(root, excludes, scope, depth = 0) {
    if (depth > 3 && !scope) {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory() && !excludes.includes(e.name)).length;
        const files = entries.filter(e => e.isFile()).length;
        return `${root.split('/').pop() || root} (${files} files, ${dirs} subdirs)`;
    }
    let tree = "";
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
        if (excludes.includes(entry.name))
            continue;
        if (entry.isDirectory()) {
            const subTree = buildDirectoryTree(path.join(root, entry.name), excludes, scope, depth + 1);
            tree += `${"  ".repeat(depth)}├── ${entry.name}/\n${subTree}\n`;
        }
        else {
            tree += `${"  ".repeat(depth)}├── ${entry.name}\n`;
        }
    }
    return tree;
}
function identifyKeyFiles(root) {
    const keyNames = [
        "package.json", "tsconfig.json", "docker-compose.yml", "Dockerfile",
        "Makefile", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt",
        "Gemfile", "build.gradle", "pom.xml", "CMakeLists.txt", "mix.exs",
        ".eslintrc", "prettier.config.js", "vite.config.ts", "webpack.config.js",
        "jest.config.js", "tailwind.config.js"
    ];
    const keyFiles = [];
    for (const name of keyNames) {
        const fullPath = path.join(root, name);
        if (fs.existsSync(fullPath)) {
            keyFiles.push(fullPath);
        }
    }
    return keyFiles;
}
function identifyEntryPoints(root) {
    const entryPoints = [];
    // Check package.json for main/bin
    const packageJsonPath = path.join(root, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            if (pkg.main)
                entryPoints.push(path.join(root, pkg.main));
            if (pkg.bin) {
                if (typeof pkg.bin === "string") {
                    entryPoints.push(path.join(root, pkg.bin));
                }
                else {
                    for (const name of Object.keys(pkg.bin)) {
                        entryPoints.push(path.join(root, pkg.bin[name]));
                    }
                }
            }
            if (pkg.exports) {
                if (typeof pkg.exports === "string") {
                    entryPoints.push(path.join(root, pkg.exports));
                }
            }
        }
        catch { }
    }
    // Check for common entry files
    const commonEntries = ["index.ts", "index.js", "main.ts", "main.js", "app.ts", "app.js", "server.ts", "server.js"];
    for (const entry of commonEntries) {
        const fullPath = path.join(root, entry);
        if (fs.existsSync(fullPath)) {
            entryPoints.push(fullPath);
        }
    }
    return entryPoints;
}
function identifyModules(root) {
    const modules = [];
    // Simple heuristic: look for directories with package.json or index files
    try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || DEFAULT_EXCLUDES.includes(entry.name))
                continue;
            const modulePath = path.join(root, entry.name);
            const hasPackageJson = fs.existsSync(path.join(modulePath, "package.json"));
            const hasIndex = fs.existsSync(path.join(modulePath, "index.ts")) || fs.existsSync(path.join(modulePath, "index.js"));
            if (hasPackageJson || hasIndex) {
                const keyFiles = [];
                const files = fs.readdirSync(modulePath, { withFileTypes: true });
                for (const file of files.slice(0, 5)) {
                    if (file.isFile() && (file.name.endsWith(".ts") || file.name.endsWith(".js"))) {
                        keyFiles.push(path.join(modulePath, file.name));
                    }
                }
                modules.push({
                    name: entry.name,
                    purpose: `Module in ${entry.name}/ directory`,
                    keyFiles,
                    dependencies: []
                });
            }
        }
    }
    catch { }
    return modules;
}
function detectLanguage(root) {
    if (fs.existsSync(path.join(root, "package.json")))
        return "TypeScript/JavaScript";
    if (fs.existsSync(path.join(root, "Cargo.toml")))
        return "Rust";
    if (fs.existsSync(path.join(root, "go.mod")))
        return "Go";
    if (fs.existsSync(path.join(root, "pyproject.toml")) || fs.existsSync(path.join(root, "requirements.txt")))
        return "Python";
    if (fs.existsSync(path.join(root, "Gemfile")))
        return "Ruby";
    if (fs.existsSync(path.join(root, "build.gradle")) || fs.existsSync(path.join(root, "pom.xml")))
        return "Java/Kotlin";
    return "Unknown";
}
function detectFramework(root) {
    if (fs.existsSync(path.join(root, "package.json"))) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
            const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            if (deps["next"])
                return "Next.js";
            if (deps["react"])
                return "React";
            if (deps["vue"])
                return "Vue.js";
            if (deps["svelte"])
                return "Svelte";
            if (deps["express"])
                return "Express.js";
            if (deps["fastify"])
                return "Fastify";
            if (deps["nuxt"])
                return "Nuxt.js";
        }
        catch { }
    }
    return "Unknown";
}
function detectBuildSystem(root) {
    if (fs.existsSync(path.join(root, "package.json")))
        return "npm/yarn/pnpm";
    if (fs.existsSync(path.join(root, "Makefile")))
        return "Make";
    if (fs.existsSync(path.join(root, "build.gradle")))
        return "Gradle";
    if (fs.existsSync(path.join(root, "CMakeLists.txt")))
        return "CMake";
    return "Unknown";
}
function describeArchitecture(root, modules) {
    if (modules.length === 0)
        return "Single-module project";
    if (modules.length <= 3)
        return "Small multi-module project";
    return `Multi-module project with ${modules.length} identified modules`;
}
function estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}
function prune(doc, { maxTokens, maxChars }) {
    const currentTokens = estimateTokens(doc);
    const currentChars = doc.length;
    if (currentTokens <= maxTokens && currentChars <= maxChars)
        return doc;
    // Trim Recent Changes to last 5 entries if over budget
    const recentChangesMatch = doc.match(/(## Recent Changes\n\n)([\s\S]*?)(?=\n---|$)/);
    if (recentChangesMatch) {
        const lines = recentChangesMatch[2].split("\n").filter(l => l.trim().startsWith("-"));
        if (lines.length > 5) {
            doc = doc.replace(recentChangesMatch[0], `$1${lines.slice(0, 5).join("\n")}\n\n`);
        }
    }
    // Compress directory tree if still over budget
    if (estimateTokens(doc) > maxTokens) {
        doc = doc.replace(/(## Directory Structure\n\n```[\s\S]*?```)/, `## Directory Structure\n\n\`\`\`\n(Compressed - see full tree in .agents/map_tree.md)\n\`\`\``);
    }
    return doc;
}
export function get_delta_sections(workspaceRoot, changedFiles) {
    const sections = [];
    // Simple heuristic: map changed files to sections
    for (const file of changedFiles) {
        const relative = path.relative(workspaceRoot, file);
        if (relative.includes("package.json") || relative.includes("tsconfig") || relative.includes("docker")) {
            sections.push("## Configuration");
        }
        else if (relative.includes("/src/") || relative.includes("/lib/") || relative.includes("/app/")) {
            const moduleName = relative.split("/")[1] || "unknown";
            sections.push(`### ${moduleName}`);
        }
        else {
            sections.push("## Directory Structure");
        }
    }
    return [...new Set(sections)];
}
