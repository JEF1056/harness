import * as fs from "fs";
import * as path from "path";

const MAX_TOKENS = 10000;
const MAX_CHARS = 40000;
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

export function build_codebase_map(workspaceRoot: string, options?: { scope?: string }): string {
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

function findFilesRecursively(root: string, excludes: string[], predicate: (file: string) => boolean, maxDepth: number = 5): string[] {
    const results: string[] = [];
    
    function scan(dir: string, currentDepth: number) {
        if (currentDepth > maxDepth) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (excludes.includes(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scan(fullPath, currentDepth + 1);
                } else if (predicate(entry.name)) {
                    results.push(fullPath);
                }
            }
        } catch {}
    }
    
    scan(root, 0);
    return results;
}

function buildDirectoryTree(root: string, excludes: string[], scope: string | null, depth: number = 0): string {
    // At depth 0, show everything. At deeper levels, be selective.
    if (depth > 4 && !scope) {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory() && !excludes.includes(e.name)).length;
        const files = entries.filter(e => e.isFile()).length;
        return `${root.split('/').pop() || root} (${files} files, ${dirs} subdirs)`;
    }
    
    let tree = "";
    const entries = fs.readdirSync(root, { withFileTypes: true });
    
    // Sort: directories first, then files alphabetically
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });
    
    for (const entry of entries) {
        if (excludes.includes(entry.name)) continue;
        if (entry.isDirectory()) {
            // Check if directory has meaningful content (source files or important config)
            const subEntries = fs.readdirSync(path.join(root, entry.name), { withFileTypes: true });
            const hasSource = subEntries.some(e => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".js") || e.name.endsWith(".tsx") || e.name.endsWith(".jsx") || e.name.endsWith(".py") || e.name.endsWith(".rs") || e.name.endsWith(".go")));
            const hasConfig = subEntries.some(e => e.isFile() && ["package.json", "tsconfig.json", "Cargo.toml", "go.mod", "pyproject.toml", "Dockerfile", "Makefile"].includes(e.name));
            
            if (depth <= 1 || hasSource || hasConfig || entry.name.match(/^(src|lib|packages|apps|app|components|services|utils|core|shared|api|server|client|web|tools|scripts|mcp|docs|config|infra|test|spec)$/)) {
                const subTree = buildDirectoryTree(path.join(root, entry.name), excludes, scope, depth + 1);
                tree += `${"  ".repeat(depth)}├── ${entry.name}/\n${subTree}\n`;
            } else {
                const subEntries2 = fs.readdirSync(path.join(root, entry.name), { withFileTypes: true });
                const fileCount = subEntries2.filter(e => e.isFile()).length;
                const dirCount = subEntries2.filter(e => e.isDirectory() && !excludes.includes(e.name)).length;
                tree += `${"  ".repeat(depth)}├── ${entry.name}/ (${fileCount} files, ${dirCount} subdirs)\n`;
            }
        } else {
            tree += `${"  ".repeat(depth)}├── ${entry.name}\n`;
        }
    }
    
    return tree;
}

function identifyKeyFiles(root: string): string[] {
    const keyNames = [
        "package.json", "tsconfig.json", "docker-compose.yml", "Dockerfile",
        "Makefile", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt",
        "Gemfile", "build.gradle", "pom.xml", "CMakeLists.txt", "mix.exs",
        ".eslintrc", "prettier.config.js", "vite.config.ts", "webpack.config.js",
        "jest.config.js", "tailwind.config.js", "README.md", ".gitignore",
        "renovate.json", "nx.json", "turbo.json", "pnpm-workspace.yaml",
        "lerna.json", "jest.config.ts", "postcss.config.js", "babel.config.js",
        "svelte.config.js", "astro.config.mjs", "nuxt.config.ts", "remix.config.js",
        ".prettierrc", "eslint.config.js", "codecov.yml", ".github",
        "fly.toml", "render.yaml", "vercel.json", "netlify.toml",
        "Makefile", "Taskfile.yml", "justfile"
    ];
    
    const keyFiles: string[] = [];
    const seen = new Set<string>();
    
    // Root-level key files
    for (const name of keyNames) {
        const fullPath = path.join(root, name);
        if (fs.existsSync(fullPath) && !seen.has(fullPath)) {
            seen.add(fullPath);
            keyFiles.push(fullPath);
        }
    }
    
    // Recursively find additional config files
    const configPatterns = ["tsconfig*.json", "jsconfig*.json", ".eslintrc*", "prettier*", "vite.config*", "webpack.config*", "jest.config*", "tailwind.config*", "babel.config*", "postcss.config*", "Dockerfile*"];
    for (const pattern of configPatterns) {
        const dir = path.dirname(pattern);
        const base = path.basename(pattern);
        const files = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => {
            const regex = new RegExp(`^${base.replace(/\*/g, ".*")}$`);
            return regex.test(name);
        }, 2);
        for (const f of files) {
            if (!seen.has(f)) {
                seen.add(f);
                keyFiles.push(f);
            }
        }
    }
    
    return keyFiles;
}

function identifyEntryPoints(root: string): string[] {
    const entryPoints: string[] = [];
    const seen = new Set<string>();
    
    const addEntry = (fp: string) => {
        if (!seen.has(fp)) {
            seen.add(fp);
            entryPoints.push(fp);
        }
    };
    
    // Check all package.json files for main/bin/exports
    const pkgFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "package.json");
    for (const pkgPath of pkgFiles) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const pkgDir = path.dirname(pkgPath);
            if (pkg.main) addEntry(path.join(pkgDir, pkg.main));
            if (pkg.bin) {
                if (typeof pkg.bin === "string") {
                    addEntry(path.join(pkgDir, pkg.bin));
                } else {
                    for (const name of Object.keys(pkg.bin)) {
                        addEntry(path.join(pkgDir, pkg.bin[name]));
                    }
                }
            }
            if (pkg.exports) {
                if (typeof pkg.exports === "string") {
                    addEntry(path.join(pkgDir, pkg.exports));
                }
            }
            if (pkg.scripts) {
                const startScript = pkg.scripts.start || pkg.scripts.dev || pkg.scripts.devserver;
                if (startScript) {
                    // Extract file from start script (e.g., "next dev" -> don't add, but "ts-node src/server.ts" -> add)
                    const tsMatch = startScript.match(/(?:ts-node|tsx|node)\s+([^\s]+)/);
                    if (tsMatch) addEntry(path.join(pkgDir, tsMatch[1]));
                }
            }
        } catch {}
    }
    
    // Check for common entry files at all depths (up to 3 levels)
    const commonEntries = ["index.ts", "index.js", "main.ts", "main.js", "app.ts", "app.js", "server.ts", "server.js", "cli.ts", "cli.js", "bootstrap.ts", "bootstrap.js"];
    const entryFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => commonEntries.includes(name), 3);
    for (const ef of entryFiles) {
        addEntry(ef);
    }
    
    // Check for Docker entrypoints
    const dockerfiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "Dockerfile", 3);
    for (const df of dockerfiles) {
        addEntry(df);
    }
    
    // Check for bin/ directories in packages
    for (const pkgPath of pkgFiles) {
        const pkgDir = path.dirname(pkgPath);
        const binDir = path.join(pkgDir, "bin");
        if (fs.existsSync(binDir) && fs.statSync(binDir).isDirectory()) {
            try {
                const binFiles = fs.readdirSync(binDir);
                for (const bf of binFiles) {
                    addEntry(path.join(binDir, bf));
                }
            } catch {}
        }
    }
    
    return entryPoints;
}

function identifyModules(root: string): Array<{ name: string; purpose: string; keyFiles: string[]; dependencies: string[] }> {
    const modules: Array<{ name: string; purpose: string; keyFiles: string[]; dependencies: string[] }> = [];
    const seen = new Set<string>();
    
    // Level 1: Top-level directories with package.json (packages/modules)
    try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || DEFAULT_EXCLUDES.includes(entry.name)) continue;
            
            const modulePath = path.join(root, entry.name);
            const hasPackageJson = fs.existsSync(path.join(modulePath, "package.json"));
            const hasCargoToml = fs.existsSync(path.join(modulePath, "Cargo.toml"));
            const hasGoMod = fs.existsSync(path.join(modulePath, "go.mod"));
            const hasPyProject = fs.existsSync(path.join(modulePath, "pyproject.toml"));
            const hasIndex = fs.existsSync(path.join(modulePath, "index.ts")) || fs.existsSync(path.join(modulePath, "index.js"));
            
            if (hasPackageJson || hasCargoToml || hasGoMod || hasPyProject || hasIndex) {
                if (!seen.has(entry.name)) {
                    seen.add(entry.name);
                    const keyFiles: string[] = [];
                    const langFiles = findFilesRecursively(modulePath, DEFAULT_EXCLUDES, (name) => 
                        name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".tsx") || name.endsWith(".jsx") || name.endsWith(".py") || name.endsWith(".rs") || name.endsWith(".go")
                    , 2);
                    for (const f of langFiles.slice(0, 8)) {
                        keyFiles.push(f);
                    }
                    
                    // Infer purpose from directory name and contents
                    let purpose = inferModulePurpose(entry.name, modulePath);
                    
                    // Find internal dependencies from package.json
                    const deps: string[] = [];
                    if (hasPackageJson) {
                        try {
                            const pkg = JSON.parse(fs.readFileSync(path.join(modulePath, "package.json"), "utf8"));
                            const workspaceDeps = Object.keys(pkg.dependencies || {}).filter(d => 
                                d.startsWith("@") || /^[a-z]/i.test(d)
                            );
                            deps.push(...workspaceDeps.slice(0, 5));
                        } catch {}
                    }
                    
                    modules.push({
                        name: entry.name,
                        purpose,
                        keyFiles,
                        dependencies: deps
                    });
                }
            }
        }
    } catch {}
    
    // Level 2: Directories that look like feature modules (src/, lib/, packages/, apps/)
    const featureDirs = ["src", "lib", "packages", "apps", "app", "apps", "components", "services", "utils", "core", "shared", "common", "api", "server", "client", "web", "mobile", "cli", "bin", "tools", "scripts", "tests", "test", "spec", "docs", "config", "configs", "infra", "deploy", "ops", "mcp", "mcp-server"];
    for (const featureDir of featureDirs) {
        const featurePath = path.join(root, featureDir);
        if (fs.existsSync(featurePath) && fs.statSync(featurePath).isDirectory()) {
            if (!seen.has(featureDir)) {
                seen.add(featureDir);
                const keyFiles: string[] = [];
                const langFiles = findFilesRecursively(featurePath, DEFAULT_EXCLUDES, (name) =>
                    name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".tsx") || name.endsWith(".jsx") || name.endsWith(".py") || name.endsWith(".rs") || name.endsWith(".go")
                , 2);
                for (const f of langFiles.slice(0, 5)) {
                    keyFiles.push(f);
                }
                
                modules.push({
                    name: featureDir,
                    purpose: inferModulePurpose(featureDir, featurePath),
                    keyFiles,
                    dependencies: []
                });
            }
        }
    }
    
    return modules;
}

function inferModulePurpose(dirName: string, dirPath: string): string {
    const name = dirName.toLowerCase();
    
    // Heuristic purpose inference based on directory name
    const purposeMap: Record<string, string> = {
        "src": "Source code",
        "lib": "Library code",
        "packages": "Monorepo packages",
        "apps": "Application entry points",
        "app": "Main application",
        "components": "UI components",
        "services": "Business logic services",
        "utils": "Utility functions",
        "core": "Core functionality",
        "shared": "Shared code",
        "common": "Common utilities",
        "api": "API endpoints and handlers",
        "server": "Server implementation",
        "client": "Client-side code",
        "web": "Web frontend",
        "mobile": "Mobile app code",
        "cli": "Command-line interface",
        "bin": "Executable binaries",
        "tools": "Development tools",
        "scripts": "Build/automation scripts",
        "tests": "Test files",
        "docs": "Documentation",
        "config": "Configuration files",
        "infra": "Infrastructure code",
        "deploy": "Deployment configs",
        "mcp": "MCP server implementation",
        "mcp-server": "MCP server implementation",
    };
    
    if (purposeMap[name]) return purposeMap[name];
    
    // Check for README or package.json description
    try {
        const readme = path.join(dirPath, "README.md");
        if (fs.existsSync(readme)) {
            const content = fs.readFileSync(readme, "utf8").split("\n").slice(0, 5).join(" ");
            if (content.trim().length > 0) return `Module: ${content.trim().substring(0, 80)}`;
        }
    } catch {}
    
    try {
        const pkgPath = path.join(dirPath, "package.json");
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            if (pkg.description) return `Module: ${pkg.description}`;
        }
    } catch {}
    
    return `Module in ${dirName}/ directory`;
}

function detectLanguage(root: string): string {
    const langScores: Record<string, number> = {};
    
    // Weight by proximity to root (closer files are more significant)
    const addScore = (file: string, lang: string) => {
        const rel = path.relative(root, file);
        const depth = rel.split(path.sep).length;
        const weight = Math.max(1, 10 - depth); // closer = higher weight
        langScores[lang] = (langScores[lang] || 0) + weight;
    };
    
    findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => {
        if (name === "package.json") addScore(path.join(root, name), "TypeScript/JavaScript");
        if (name === "Cargo.toml") addScore(path.join(root, name), "Rust");
        if (name === "go.mod") addScore(path.join(root, name), "Go");
        if (name === "pyproject.toml" || name === "requirements.txt" || name === "setup.py" || name === "setup.cfg") addScore(path.join(root, name), "Python");
        if (name === "Gemfile") addScore(path.join(root, name), "Ruby");
        if (name === "build.gradle" || name === "pom.xml") addScore(path.join(root, name), "Java/Kotlin");
        if (name === "mix.exs") addScore(path.join(root, name), "Elixir");
        if (name === "Dockerfile" || name === "docker-compose.yml") addScore(path.join(root, name), "Containerized");
        return false;
    });
    
    // Also check for source file extensions as a fallback signal
    const tsFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name.endsWith(".ts") || name.endsWith(".tsx")).length;
    const jsFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name.endsWith(".js") || name.endsWith(".jsx")).length;
    const pyFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name.endsWith(".py")).length;
    const rsFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name.endsWith(".rs")).length;
    const goFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name.endsWith(".go")).length;
    
    if (tsFiles + jsFiles > 0) langScores["TypeScript/JavaScript"] = (langScores["TypeScript/JavaScript"] || 0) + Math.min(tsFiles + jsFiles, 100);
    if (pyFiles > 0) langScores["Python"] = (langScores["Python"] || 0) + Math.min(pyFiles, 100);
    if (rsFiles > 0) langScores["Rust"] = (langScores["Rust"] || 0) + Math.min(rsFiles, 100);
    if (goFiles > 0) langScores["Go"] = (langScores["Go"] || 0) + Math.min(goFiles, 100);
    
    // Return the language with the highest score
    let bestLang = "Unknown";
    let bestScore = 0;
    for (const [lang, score] of Object.entries(langScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestLang = lang;
        }
    }
    
    return bestLang;
}

function detectFramework(root: string): string {
    const frameworkScores: Record<string, number> = {};
    
    const addFramework = (fw: string, score: number) => {
        frameworkScores[fw] = (frameworkScores[fw] || 0) + score;
    };
    
    // Scan all package.json files for JS/TS frameworks
    const pkgFiles = findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "package.json");
    for (const pkgPath of pkgFiles) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            const rel = path.relative(root, pkgPath);
            const weight = Math.max(1, 10 - rel.split(path.sep).length);
            
            if (deps["next"]) addFramework("Next.js", weight * 3);
            if (deps["react"]) addFramework("React", weight * 2);
            if (deps["vue"]) addFramework("Vue.js", weight * 2);
            if (deps["svelte"]) addFramework("Svelte", weight * 2);
            if (deps["express"]) addFramework("Express.js", weight * 2);
            if (deps["fastify"]) addFramework("Fastify", weight * 2);
            if (deps["nuxt"]) addFramework("Nuxt.js", weight * 2);
            if (deps["tailwindcss"]) addFramework("Tailwind CSS", weight);
            if (deps["typescript"]) addFramework("TypeScript", weight);
        } catch {}
    }
    
    // Check for Docker-based frameworks
    if (fs.existsSync(path.join(root, "docker-compose.yml")) || fs.existsSync(path.join(root, "docker-compose.yaml"))) {
        addFramework("Docker", 5);
    }
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "Dockerfile").length > 0) {
        addFramework("Docker", 3);
    }
    
    // ML/DL frameworks
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "pyproject.toml" || name === "requirements.txt").length > 0) {
        for (const reqFile of findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "requirements.txt")) {
            try {
                const content = fs.readFileSync(reqFile, "utf8");
                if (content.includes("torch") || content.includes("pytorch")) addFramework("PyTorch", 3);
                if (content.includes("tensorflow") || content.includes("tf")) addFramework("TensorFlow", 3);
                if (content.includes("transformers")) addFramework("HuggingFace Transformers", 2);
                if (content.includes("langchain")) addFramework("LangChain", 2);
            } catch {}
        }
    }
    
    // Return the framework with the highest score
    let bestFramework = "Unknown";
    let bestScore = 0;
    for (const [fw, score] of Object.entries(frameworkScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestFramework = fw;
        }
    }
    
    return bestScore > 0 ? bestFramework : "Unknown";
}

function detectBuildSystem(root: string): string {
    const buildSystems: string[] = [];
    
    // Check for any package.json (npm/yarn/pnpm)
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "package.json").length > 0) {
        buildSystems.push("npm/yarn/pnpm");
    }
    
    // Check for Makefile
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "Makefile").length > 0) {
        buildSystems.push("Make");
    }
    
    // Check for Gradle
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "build.gradle" || name === "build.gradle.kts").length > 0) {
        buildSystems.push("Gradle");
    }
    
    // Check for CMake
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "CMakeLists.txt").length > 0) {
        buildSystems.push("CMake");
    }
    
    // Check for Cargo (Rust)
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "Cargo.toml").length > 0) {
        buildSystems.push("Cargo/crates.io");
    }
    
    // Check for Go modules
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "go.mod").length > 0) {
        buildSystems.push("Go modules");
    }
    
    // Check for Docker
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "Dockerfile" || name === "docker-compose.yml" || name === "docker-compose.yaml").length > 0) {
        buildSystems.push("Docker");
    }
    
    // Check for pip/Python
    if (findFilesRecursively(root, DEFAULT_EXCLUDES, (name) => name === "pyproject.toml" || name === "setup.py" || name === "requirements.txt").length > 0) {
        buildSystems.push("pip/venv");
    }
    
    return buildSystems.length > 0 ? buildSystems.join(", ") : "Unknown";
}

function describeArchitecture(root: string, modules: Array<{ name: string; purpose: string; keyFiles: string[]; dependencies: string[] }>): string {
    if (modules.length === 0) return "Single-module project";
    if (modules.length <= 3) return "Small multi-module project";
    return `Multi-module project with ${modules.length} identified modules`;
}

function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}

function prune(doc: string, { maxTokens, maxChars }: { maxTokens: number; maxChars: number }): string {
    const currentTokens = estimateTokens(doc);
    const currentChars = doc.length;
    
    if (currentTokens <= maxTokens && currentChars <= maxChars) return doc;
    
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

export function get_delta_sections(workspaceRoot: string, changedFiles: string[]): string[] {
    const sections: string[] = [];
    
    // Simple heuristic: map changed files to sections
    for (const file of changedFiles) {
        const relative = path.relative(workspaceRoot, file);
        
        if (relative.includes("package.json") || relative.includes("tsconfig") || relative.includes("docker")) {
            sections.push("## Configuration");
        } else if (relative.includes("/src/") || relative.includes("/lib/") || relative.includes("/app/")) {
            const moduleName = relative.split("/")[1] || "unknown";
            sections.push(`### ${moduleName}`);
        } else {
            sections.push("## Directory Structure");
        }
    }
    
    return [...new Set(sections)];
}
